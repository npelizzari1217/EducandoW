import { SetMetadata } from '@nestjs/common';
import { EducationalLevelCode } from '@educandow/domain';

export const LEVELS_KEY = 'levels';

export const Levels = (...codes: EducationalLevelCode[]) => SetMetadata(LEVELS_KEY, codes);
