interface DemoProps {
  heading: string;
}

export default function Demo({ heading }: DemoProps) {
  return (
    <section style={{ height: 200, background: "rgb(10, 120, 200)" }}>
      <h1 style={{ margin: 0, fontSize: 32 }}>{heading}</h1>
    </section>
  );
}
