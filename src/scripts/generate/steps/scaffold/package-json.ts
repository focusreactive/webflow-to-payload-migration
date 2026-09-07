import { DELIVERABLE_VERSIONS as V } from "../../constants/versions.ts";

export function emitPackageJson(projectName: string): string {
  const pkg = {
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "cross-env NODE_OPTIONS=--no-deprecation next dev",
      build: "cross-env NODE_OPTIONS=--no-deprecation next build",
      start: "cross-env NODE_OPTIONS=--no-deprecation next start",
      payload: "cross-env NODE_OPTIONS=--no-deprecation payload",
      "generate:types": "cross-env NODE_OPTIONS=--no-deprecation payload generate:types",
      "generate:importmap": "cross-env NODE_OPTIONS=--no-deprecation payload generate:importmap",
      lint: "cross-env NODE_OPTIONS=--no-deprecation eslint .",
      seed: "cross-env NODE_OPTIONS=--no-deprecation payload run src/seed/index.ts",
    },
    dependencies: {
      "@payloadcms/db-sqlite": V.payload,
      "@payloadcms/next": V.payload,
      "@payloadcms/richtext-lexical": V.payload,
      "@payloadcms/ui": V.payload,
      "cross-env": V.crossEnv,
      graphql: V.graphql,
      jsdom: V.jsdom,
      next: V.next,
      payload: V.payload,
      react: V.react,
      "react-dom": V.react,
      sharp: V.sharp,
    },
    devDependencies: {
      "@tailwindcss/postcss": V.tailwindPostcss,
      "@types/jsdom": V.typesJsdom,
      "@types/node": V.typesNode,
      "@types/react": V.typesReact,
      "@types/react-dom": V.typesReactDom,
      eslint: V.eslint,
      "eslint-config-next": V.eslintConfigNext,
      tailwindcss: V.tailwindcss,
      typescript: V.typescript,
    },
    engines: { node: V.node },
    pnpm: { onlyBuiltDependencies: ["sharp"] },
  };

  return `${JSON.stringify(pkg, null, 2)}\n`;
}
