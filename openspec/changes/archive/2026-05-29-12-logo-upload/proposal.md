# Proposal: Upload de Logo Institucional con Reemplazo Automático

## Intent
Permitir que los administradores suban el logo de la institución desde el formulario de configuración. El logo se almacena en disco (no en DB) y se referencia por path. Un solo logo por institución: al subir uno nuevo, reemplaza al anterior.

## Scope

### In Scope
- Puerto `FileStoragePort` en capa de aplicación
- Adapter `LocalDiskStorageAdapter` para almacenamiento en disco
- Endpoint `POST /institutions/:id/logo` con multer (multipart, 5MB max, solo imágenes)
- Servir archivos estáticos desde `/uploads/` en NestJS
- Preview del logo actual en formulario frontend (96x96px con fallback)
- Botón "Subir Logo" con input type=file
- Campo URL manual como fallback

### Out of Scope
- Almacenamiento cloud (S3)
- Redimensionamiento de imágenes
- Múltiples archivos por institución

## Capabilities

### New Capabilities
- `file-storage`: Almacenamiento de archivos con puerto/adapter

### Modified Capabilities
- `institution-settings`: Campo logo_url ahora puede ser path local o URL remota

## Success Criteria
- [x] Build compila sin errores
- [x] POST /institutions/:id/logo acepta multipart y guarda en disco
- [x] Logo previo se reemplaza al subir uno nuevo
- [x] Frontend muestra preview del logo guardado
- [x] URL manual sigue funcionando como fallback
