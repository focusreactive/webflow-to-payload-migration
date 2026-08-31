{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "noEmit": true,
    "incremental": true,
    "jsx": "react-jsx",
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "sourceMap": true,
    "isolatedModules": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@payload-config": ["./src/payload.config.ts"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts", "next-env.d.ts"],
  "exclude": ["node_modules", ".migration", "migration"]
}
