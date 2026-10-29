export function SolarCircuitVisual() {
  return (
    <div className="circuit" aria-label="แผนภาพตัวอย่างการเชื่อมต่อแผง PV กับ MPPT">
      <div className="circuit__sun" aria-hidden="true" />
      <div className="circuit__label circuit__label--top">
        <span>STRING A</span>
        <strong>10 × 550 Wp</strong>
      </div>
      <div className="circuit__panels" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="circuit__wire" aria-hidden="true">
        <i />
      </div>
      <div className="circuit__inverter">
        <span>MPPT 01</span>
        <strong>438.6 V</strong>
        <small>Nominal preview</small>
      </div>
      <div className="circuit__readout" aria-hidden="true">
        <span>Voc cold</span>
        <b>PASS</b>
      </div>
    </div>
  );
}
