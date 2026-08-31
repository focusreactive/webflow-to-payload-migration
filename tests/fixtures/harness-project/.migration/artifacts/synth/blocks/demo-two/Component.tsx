interface DemoTwoProps {
  label: string;
}

export default function DemoTwo({ label }: DemoTwoProps) {
  return (
    <section style={{ height: 120, background: "rgb(200, 60, 10)" }}>
      <p style={{ margin: 0, fontSize: 20 }}>{label}</p>
    </section>
  );
}
