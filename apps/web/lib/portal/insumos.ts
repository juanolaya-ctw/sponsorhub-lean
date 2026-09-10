// Lista fija de insumos que el sponsor debe entregar, según el documento de
// Customer Success. NO depende del tier: son los mismos para todos los
// sponsors. El valor `key` se guarda en `archivos.tipo` para poder marcar
// cada insumo como "Subido" sin cambiar el esquema.

export type InsumoRequerido = {
  key: string;
  nombre: string;
  descripcion: string;
};

export const INSUMOS_REQUERIDOS: InsumoRequerido[] = [
  {
    key: "logo_ai",
    nombre: "Logo en .ai (o imagen de alta resolución)",
    descripcion:
      "Archivo vectorial editable. Si no lo tienes, una imagen PNG en la máxima resolución disponible.",
  },
  {
    key: "manual_marca",
    nombre: "Manual de marca y guía de uso",
    descripcion:
      "Documento con colores, tipografías y usos correctos del logo.",
  },
  {
    key: "donts_marca",
    nombre: "Don'ts de aplicación de marca",
    descripcion:
      "Ejemplos de usos incorrectos del logo que debemos evitar en las piezas.",
  },
  {
    key: "info_newsletter",
    nombre: "Información para newsletter",
    descripcion:
      "Texto e imágenes que quieres que aparezcan en el correo a la comunidad.",
  },
  {
    key: "info_redes",
    nombre: "Información para post en redes",
    descripcion:
      "Copy, hashtags y piezas para la publicación en redes sociales.",
  },
  {
    key: "ppt_keynote",
    nombre: "PPT para keynote/workshop (si aplica)",
    descripcion:
      "Presentación de tu charla o taller. Solo si tu paquete incluye espacio en agenda.",
  },
  {
    key: "punto_contacto",
    nombre: "Punto de contacto (nombre, email, teléfono)",
    descripcion:
      "Persona responsable de la activación por parte de tu equipo. Puede ser un documento o captura.",
  },
];
