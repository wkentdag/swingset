import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { existsSync } from 'fsexists'
import requireFromString from 'require-from-string'
import renderToString from 'next-mdx-remote/render-to-string'
import createScope from './utils/create-scope'
import components from './__swingset_components'

export function createStaticPaths(swingsetOptions = {}) {
  return async function getStaticPaths() {
    // const componentPaths = components.map(({ componentName }) => ({
    //   params: {
    //     component: componentName,
    //   }
    // }))

    const componentPaths = [
      {
        params: { component: 'Accordion' },
      },
      {
        params: { component: 'GridList' },
      },
    ]

    console.log('componentPaths:')
    console.log(componentPaths)
    return {
      paths: componentPaths,
      fallback: false,
    }
  }
}

// TODO: this whole thing honestly needs a refactor
export default function createStaticProps(swingsetOptions = {}) {
  return async function getStaticProps({ params }) {
    const activeComponentName = params.component

    const component = components[activeComponentName]

    // Read the docs file, separate content from frontmatter
    const { content, data } = matter(
      fs.readFileSync(component.docsPath, 'utf8')
    )
    //  Read and parse the component's package.json, if possible
    const pathToPackageJson = path.join(component.path, 'package.json')
    const packageJson = existsSync(pathToPackageJson)
      ? JSON.parse(fs.readFileSync(pathToPackageJson, 'utf8'))
      : null

    // Check for a file called 'props.json5' - if it exists, we import it as `props`
    // to the mdx file. This is a nice pattern for knobs and props tables.
    const propsContent =
      existsSync(component.propsPath) &&
      fs.readFileSync(component.propsPath, 'utf8')

    const pageProps = {
      frontMatter: data,
      props: propsContent,
      propsPath: component.propsPath,
      packageJson,
      // Automatically inject a primary headline containing the component's name
      content: `# \`<${data.componentName}>\` Component\n${content}`,
    }

    // First, we need to get the actual component source
    const Component = component.src

    let peerComponents = {}
    if (data.peerComponents) {
      data.peerComponents.forEach((name) => {
        const { src } = components[name]
        if (!src) {
          console.warn(
            `${frontMatter.componentName} lists ${name} as a peerComponent but <${name} /> is not in scope`
          )
        } else {
          peerComponents = Object.assign(peerComponents, {
            [name]: src,
          })
        }
      })
    }

    // Next, we render the content, passing as the second argument a "scope" object, which contains
    // our component and some additional presentational components that are made available in the mdx file.
    const mdx = await renderToString(content, {
      components: createScope(
        { [activeComponentName]: Component },
        swingsetOptions,
        peerComponents
      ),
      scope: {
        componentProps: propsContent ? requireFromString(propsContent, component.propsPath) : null,
        packageJson,
      },
      mdxOptions: swingsetOptions.mdxOptions || {},
    })

    return {
      activeComponentName,
      componentNames: components.map(({ componentName }) => componentName),
      ...pageProps,
    }
  }
}
