function pascalCase(name: string): string {
  return name
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function richTextWrapperName(name: string): string {
  return `RichText${pascalCase(name)}`;
}

export function richTextWrapperFile(name: string): string {
  return `richtext/${name}.tsx`;
}

export function richTextWrapperImport(name: string): string {
  return `./richtext/${name}`;
}
