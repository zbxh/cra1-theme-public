/** The chart library keeps its positioning; the surface uses our shared skin. */
export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="cui-popover cui-chart-tooltip" role="tooltip">
      <p className="cui-chart-tooltip__label">{label}</p>
      {payload.filter((item) => item.value != null).map((item, index) => {
        const result = formatter?.(item.value, item.name, item) ?? [item.value, item.name]
        const [value, name] = Array.isArray(result) ? result : [result, item.name]
        return <div key={`${item.dataKey}-${index}`} className="cui-chart-tooltip__row">
          <span className="cui-chart-tooltip__dot" style={{ background: item.color }} aria-hidden="true" />
          <span>{name}</span><strong>{value}</strong>
        </div>
      })}
    </div>
  )
}
