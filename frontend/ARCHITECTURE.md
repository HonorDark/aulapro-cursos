# Arquitectura del frontend

El frontend se organiza por responsabilidad y por dominio. Las páginas nuevas no
deben concentrar consultas HTTP, formularios y componentes visuales en un mismo
archivo.

## Estructura

```text
src/
├── app/                 # Router y composición general de la aplicación
├── components/          # Compatibilidad y layouts compartidos
│   └── shared-layout/   # Marca, cabeceras, sidebar, topbar y buscador
├── features/            # Funcionalidad agrupada por dominio
│   ├── auth/
│   ├── course-editor/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types.ts
│   └── courses/
├── routes/              # Guards de autorización y destinos por rol
├── shared/              # Código sin conocimiento de páginas concretas
│   ├── api/
│   ├── constants/
│   └── utils/
├── styles/              # Punto central de la cascada global durante la migración
└── pages/                # Entradas de ruta y adaptadores legacy
```

## Reglas de implementación

1. Una página coordina componentes; no debe contener componentes extensos
   reutilizables ni el cliente HTTP.
2. Las operaciones de un dominio viven en un hook del feature o en su carpeta
   `api/`.
3. Los componentes compartidos no importan páginas ni código de un feature.
4. Los tipos de API deben ser explícitos. No se permite agregar `@ts-nocheck`.
5. Las constantes de etiquetas, roles y formatos se centralizan en `shared/`.
6. Se conservan temporalmente barrels en `components/`, `context/`, `services/`
   y `pages/` para migrar imports sin romper rutas existentes.
7. Los estilos nuevos deben tener una sola fuente por selector. No se agregan
   nuevas hojas para sobrescribir una anterior.
8. Cada refactor debe terminar con `npm run build` y `npm run lint`.

## Ejemplo de feature

`features/course-editor` es el patrón de referencia:

- `CourseEditorPage.tsx`: composición de la pantalla.
- `hooks/useCourseEditor.ts`: estado, consultas y mutaciones.
- `components/`: formularios, selector, módulos y modal.
- `types.ts`: contratos internos del editor.

Las próximas migraciones recomendadas son `payments`, `academic` y `classroom`.
