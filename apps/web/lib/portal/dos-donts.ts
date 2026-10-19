export type DosDontsRow = {
  do: string
  dont: string
}

export type DosDontsTabla = {
  titulo?: string
  filas: DosDontsRow[]
}

export type DosDontsVariante = "newsletter" | "redes"

const FILAS_EDITORIALES: DosDontsRow[] = [
  {
    do: "Tono aspiracional.",
    dont: 'Venta directa, lenguaje comercial ("gratis", "oferta", "último día").',
  },
  {
    do: "Un solo CTA principal en el cuerpo.",
    dont: "Dos enlaces compitiendo por atención en el mismo bloque.",
  },
  {
    do: "Una imagen que acompañe la pieza editorial. Tiene que verse como parte de la historia que se cuenta (una escena real, el producto en uso, una persona del equipo), no como una pieza publicitaria con textos o marcos superpuestos, ni gráfica explicativa del texto. El logo puede pedirse aparte para identificar al patrocinador, pero no reemplaza esta imagen.",
    dont: "Usar el logo de la marca como si fuera la imagen de la pieza.",
  },
]

const FILAS_TECNICAS_GMAIL: DosDontsRow[] = [
  {
    do: "Pedir siempre las imágenes ya comprimidas/optimizadas.",
    dont: "Aceptar archivos en alta resolución sin procesar — rompen el límite de peso que usa Gmail para recortar correos.",
  },
]

export function getDosDontsTablas(
  variante: DosDontsVariante,
): DosDontsTabla[] {
  if (variante === "newsletter") {
    return [
      {
        titulo: "Contenido y tono",
        filas: [
          FILAS_EDITORIALES[0]!,
          FILAS_EDITORIALES[1]!,
          {
            do: `${FILAS_EDITORIALES[2]!.do} Dimensiones: 1200 × 675 px. Peso: no más de 20 KB. Si no se recibe foto: sale el slot con solo texto y el enlace.`,
            dont: FILAS_EDITORIALES[2]!.dont,
          },
        ],
      },
      {
        titulo: "Archivos de imagen",
        filas: FILAS_TECNICAS_GMAIL,
      },
    ]
  }

  return [
    {
      titulo: "Contenido y tono",
      filas: FILAS_EDITORIALES,
    },
  ]
}
