import { html } from 'htm/preact'
import { useRef, useEffect } from 'preact/hooks'
import Chart from 'chart.js/auto'

// Grafico de barras: % de carpetas creadas por sitio.
export function AvanceChart({ sitios }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return undefined

    const labels = sitios.map((s) => s.slug.replace(/^SGSI-/, ''))
    const data = sitios.map((s) => s.pct)
    const colors = sitios.map((s) =>
      !s.existeSitio ? '#dc2626' : s.pct === 100 ? '#2e8b57' : '#d97706'
    )

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: '% carpetas creadas', data, backgroundColor: colors }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } },
          x: { ticks: { autoSkip: false, maxRotation: 60, minRotation: 45 } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const s = sitios[ctx.dataIndex]
                return `${s.pct}% (${s.creadas}/${s.total})`
              }
            }
          }
        }
      }
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [sitios])

  return html`<div class="chart-box"><canvas ref=${canvasRef}></canvas></div>`
}
