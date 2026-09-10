// Lista fija de insumos que el sponsor debe entregar, según el documento de
// Customer Success. NO depende del tier: son los mismos para todos los
// sponsors. El valor `key` se guarda en `archivos.tipo` para poder marcar
// cada insumo como "Subido" sin cambiar el esquema.
//
// `tipo` define cómo se captura el insumo en el portal:
//   - "archivo":    subida de archivo al bucket de Storage.
//   - "texto+link": texto libre + URL. Se guarda el texto en
//                   `archivos.nombre_archivo` y el link en `archivos.storage_path`.
//   - "texto":      solo campos de texto (sin archivo). El resumen va en
//                   `archivos.nombre_archivo`; `storage_path` queda con el
//                   centinela "texto".

export type InsumoTipo = "archivo" | "texto+link" | "texto";

export type InsumoRequerido = {
  key: string;
  nombre: string;
  descripcion: string;
  tipo: InsumoTipo;
};

export const INSUMOS_REQUERIDOS: InsumoRequerido[] = [
  {
    key: "logo_ai",
    nombre: "Logo en .ai (o imagen de alta resolución)",
    descripcion:
      "Archivo vectorial editable. Si no lo tienes, una imagen PNG en la máxima resolución disponible.",
    tipo: "archivo",
  },
  {
    key: "manual_marca",
    nombre: "Manual de marca, guía de uso y don'ts de aplicación",
    descripcion:
      "Documento con colores, tipografías, usos correctos del logo y ejemplos de usos incorrectos que debemos evitar.",
    tipo: "archivo",
  },
  {
    key: "info_newsletter",
    nombre: "Información para newsletter",
    descripcion:
      "Texto que quieres que aparezca en el correo a la comunidad, con el enlace de referencia.",
    tipo: "texto+link",
  },
  {
    key: "info_redes",
    nombre: "Información para post en redes",
    descripcion:
      "Copy y hashtags para la publicación en redes sociales, con el enlace de referencia.",
    tipo: "texto+link",
  },
  {
    key: "ppt_keynote",
    nombre: "PPT para keynote/workshop (si aplica)",
    descripcion:
      "Presentación de tu charla o taller. Solo si tu paquete incluye espacio en agenda.",
    tipo: "archivo",
  },
  {
    key: "punto_contacto",
    nombre: "Punto de contacto (nombre, email, teléfono)",
    descripcion:
      "Persona responsable de la activación por parte de tu equipo.",
    tipo: "texto",
  },
];
