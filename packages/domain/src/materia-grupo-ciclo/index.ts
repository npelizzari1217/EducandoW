// Entities
export { MateriaXCursoXCiclo } from './entities/materia-x-curso-x-ciclo';
export type { MateriaXCursoXCicloProps, CreateMateriaXCursoXCicloInput } from './entities/materia-x-curso-x-ciclo';

export { AlumnosXMateriaXCursoXCiclo } from './entities/alumnos-x-materia-x-curso-x-ciclo';
export type { AlumnosXMateriaXCursoXCicloProps, CreateAlumnosXMateriaXCursoXCicloInput } from './entities/alumnos-x-materia-x-curso-x-ciclo';

export { GrupoXCursoXMateriaXCiclo } from './entities/grupo-x-curso-x-materia-x-ciclo';
export type { GrupoXCursoXMateriaXCicloProps, CreateGrupoXCursoXMateriaXCicloInput } from './entities/grupo-x-curso-x-materia-x-ciclo';

export { AlumnosXGrupoXCursoXMateriaXCiclo } from './entities/alumnos-x-grupo-x-curso-x-materia-x-ciclo';
export type { AlumnosXGrupoXCursoXMateriaXCicloProps, CreateAlumnosXGrupoXCursoXMateriaXCicloInput } from './entities/alumnos-x-grupo-x-curso-x-materia-x-ciclo';

// Repository interfaces (ports)
export type { MateriaXCursoXCicloRepository } from './repositories/materia-x-curso-x-ciclo-repository';
export type { AlumnosXMateriaRepository } from './repositories/alumnos-x-materia-repository';
export type { GrupoRepository, GrupoGlobalFilters, GrupoGlobalRow } from './repositories/grupo-repository';
export type { AlumnosXGrupoRepository } from './repositories/alumnos-x-grupo-repository';
