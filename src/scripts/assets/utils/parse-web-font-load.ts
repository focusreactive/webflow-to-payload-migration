export function extractBalancedBrackets(
  text: string,
  fromIndex: number,
  open: string,
  close: string,
): string | undefined {
  const start = text.indexOf(open, fromIndex);
  if (start < 0) return undefined;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === open) depth += 1;
    else if (text[i] === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start + 1, i);
    }
  }
  return undefined;
}
