import {
  componentGuardrailWarnings,
  harnessOnlyAssetWarnings,
  unrenderedFieldWarnings,
} from "#synth/utils/component-guardrails.ts";

describe("harnessOnlyAssetWarnings", () => {
  it("flags a component that hardcodes the harness's own /@fs route", () => {
    const component = `<img src="/@fs/Users/me/site/.migration/snapshot/media/hero.webp" />`;
    const warnings = harnessOnlyAssetWarnings(component);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/"\/@fs" path/);
  });

  it("flags a component that hardcodes a replay asset path", () => {
    const warnings = harnessOnlyAssetWarnings(`<img src="/a/72882ff9993e8591" />`);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/replay asset path/);
  });

  it("is silent for a component that renders media through its props", () => {
    expect(harnessOnlyAssetWarnings(`<img src={cover.src} alt={cover.alt} />`)).toEqual([]);
  });

  it("does not mistake an ordinary route for the replay asset route", () => {
    expect(harnessOnlyAssetWarnings(`<a href="/about/team">Team</a>`)).toEqual([]);
  });
});

describe("unrenderedFieldWarnings", () => {
  it("flags a declared field the component never references", () => {
    const component = `export default function Component() { return <div>hardcoded</div>; }`;
    const warnings = unrenderedFieldWarnings(component, [{ name: "relatedPosts" }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/never references its own declared field "relatedPosts"/);
  });

  it("is silent when the component destructures the field as a prop", () => {
    const component = `export default function Component({ relatedPosts }: Props) { return <div>{relatedPosts.length}</div>; }`;
    expect(unrenderedFieldWarnings(component, [{ name: "relatedPosts" }])).toEqual([]);
  });

  it("reports one warning per dropped field, in field order", () => {
    const component = `export default function Component({ tags }: Props) { return <div>{tags}</div>; }`;
    const warnings = unrenderedFieldWarnings(component, [{ name: "tags" }, { name: "intro" }, { name: "heroImage" }]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/"intro"/);
    expect(warnings[1]).toMatch(/"heroImage"/);
  });
});

describe("componentGuardrailWarnings", () => {
  // The bug this module exists to catch: a surface declares "relatedPosts" (so input.json
  // resolves it into real documents) but the component takes no props and renders a hardcoded
  // lookalike array pointing at a dev-only asset route — a defect that ships broken content and
  // 404s on every real load, while every accept check on input.json alone still passes.
  it("reports both defect classes together", () => {
    const component = [
      `const CARDS = [{ title: "Nova", src: "/@fs/tmp/nova.webp" }];`,
      `export default function Component() {`,
      `  return CARDS.map((card) => <img key={card.title} src={card.src} />);`,
      `}`,
    ].join("\n");
    const warnings = componentGuardrailWarnings(component, [{ name: "relatedPosts" }]);
    expect(warnings).toHaveLength(2);
    expect(warnings.some((warning) => warning.includes("/@fs"))).toBe(true);
    expect(warnings.some((warning) => warning.includes('"relatedPosts"'))).toBe(true);
  });

  it("is silent for a component that renders every declared field and no dev-only path", () => {
    const component = `export default function Component({ relatedPosts, heroImage }: Props) { return null; }`;
    expect(componentGuardrailWarnings(component, [{ name: "relatedPosts" }, { name: "heroImage" }])).toEqual([]);
  });
});
