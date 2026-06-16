import { Id } from '../../shared/value-objects/id';
import { EducationalLevelCode } from '../../shared/value-objects/educational-level';
import { EducationalModalityCode } from '../../shared/value-objects/educational-modality';
import { Level } from '../value-objects/level';
import { HexColor } from '../value-objects/hex-color';
import { Cue } from '../value-objects/cue';

export interface InstitutionLevelEntry {
  level: EducationalLevelCode;
  modality: EducationalModalityCode;
}

export interface InstitutionProps {
  id: Id;
  name: string;
  cue?: Cue;
  ministryReg?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  website?: string;
  contactEmail?: string;
  logoUrl?: string;
  headerColor?: HexColor;
  headerTextColor?: HexColor;
  bodyTextColor?: HexColor;
  bodyColor?: HexColor;
  footerColor?: HexColor;
  footerTextColor?: HexColor;
  smtpHost?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpEncryption?: string;
  smtpPort?: number;
  sendEmail?: boolean;
  sendMessages?: boolean;
  socketHost?: string;
  socketPort?: number;
  sessionTimeoutMinutes?: number;
  active?: boolean;
  deletedAt?: Date;
  dbName?: string;
  institutionLevels: InstitutionLevelEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class Institution {
  private constructor(private readonly props: InstitutionProps) {}

  static create(props: Omit<InstitutionProps, 'id' | 'dbName' | 'createdAt' | 'updatedAt'> &
    Partial<Pick<InstitutionProps, 'dbName' | 'createdAt' | 'updatedAt'>>): Institution {
    const id = Id.create();
    const now = new Date();
    return new Institution({
      ...props,
      id,
      name: props.name,
      institutionLevels: props.institutionLevels,
      country: props.country ?? 'AR',
      active: props.active ?? true,
      sendEmail: props.sendEmail ?? false,
      sendMessages: props.sendMessages ?? false,
      cue: props.cue,
      ministryReg: props.ministryReg,
      address: props.address,
      city: props.city,
      postalCode: props.postalCode,
      phone: props.phone,
      website: props.website,
      contactEmail: props.contactEmail,
      logoUrl: props.logoUrl,
      headerColor: props.headerColor,
      headerTextColor: props.headerTextColor,
      bodyTextColor: props.bodyTextColor,
      bodyColor: props.bodyColor,
      footerColor: props.footerColor,
      footerTextColor: props.footerTextColor,
      smtpHost: props.smtpHost,
      smtpUser: props.smtpUser,
      smtpPass: props.smtpPass,
      smtpEncryption: props.smtpEncryption,
      smtpPort: props.smtpPort,
      socketHost: props.socketHost,
      socketPort: props.socketPort,
      sessionTimeoutMinutes: props.sessionTimeoutMinutes ?? 20,
      dbName: props.dbName ?? `educandow_${id.get()}`,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: InstitutionProps): Institution {
    return new Institution(props);
  }

  // ── Identity ───────────────────────────────────────────

  get id(): Id {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get cue(): Cue | undefined {
    return this.props.cue;
  }

  get ministryReg(): string | undefined {
    return this.props.ministryReg;
  }

  // ── Contact ────────────────────────────────────────────

  get address(): string | undefined {
    return this.props.address;
  }

  get city(): string | undefined {
    return this.props.city;
  }

  get postalCode(): string | undefined {
    return this.props.postalCode;
  }

  get country(): string | undefined {
    return this.props.country;
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get website(): string | undefined {
    return this.props.website;
  }

  get contactEmail(): string | undefined {
    return this.props.contactEmail;
  }

  // ── Branding ───────────────────────────────────────────

  get logoUrl(): string | undefined {
    return this.props.logoUrl;
  }

  get headerColor(): HexColor | undefined {
    return this.props.headerColor;
  }

  get headerTextColor(): HexColor | undefined {
    return this.props.headerTextColor;
  }

  get bodyTextColor(): HexColor | undefined {
    return this.props.bodyTextColor;
  }

  get bodyColor(): HexColor | undefined {
    return this.props.bodyColor;
  }

  get footerColor(): HexColor | undefined {
    return this.props.footerColor;
  }

  get footerTextColor(): HexColor | undefined {
    return this.props.footerTextColor;
  }

  // ── SMTP ───────────────────────────────────────────────

  get smtpHost(): string | undefined {
    return this.props.smtpHost;
  }

  get smtpUser(): string | undefined {
    return this.props.smtpUser;
  }

  get smtpPass(): string | undefined {
    return this.props.smtpPass;
  }

  get smtpEncryption(): string | undefined {
    return this.props.smtpEncryption;
  }

  get smtpPort(): number | undefined {
    return this.props.smtpPort;
  }

  // ── Notification flags ─────────────────────────────────

  get sendEmail(): boolean | undefined {
    return this.props.sendEmail;
  }

  get sendMessages(): boolean | undefined {
    return this.props.sendMessages;
  }

  // ── Socket ─────────────────────────────────────────────

  get socketHost(): string | undefined {
    return this.props.socketHost;
  }

  get socketPort(): number | undefined {
    return this.props.socketPort;
  }

  get sessionTimeoutMinutes(): number {
    return this.props.sessionTimeoutMinutes ?? 20;
  }

  // ── Config ─────────────────────────────────────────────

  get active(): boolean | undefined {
    return this.props.active;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  get dbName(): string | undefined {
    return this.props.dbName;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  // ── Levels ─────────────────────────────────────────────

  get institutionLevels(): InstitutionLevelEntry[] {
    return [...this.props.institutionLevels];
  }

  /** Convenience: returns Level array (computed from level+modality). */
  get levels(): Level[] {
    return this.props.institutionLevels.map((e) =>
      Level.fromParts(e.level, e.modality),
    );
  }

  /** ¿Tiene exactamente este nivel (levelCode + modalityCode)? */
  hasLevel(levelCode: EducationalLevelCode, modalityCode: EducationalModalityCode): boolean {
    return this.props.institutionLevels.some(
      (l) => l.level === levelCode && l.modality === modalityCode,
    );
  }

  /** ¿Tiene algún nivel que pertenezca a este nivel base (ignorando modalidad)? */
  hasEducationalLevel(levelCode: EducationalLevelCode): boolean {
    return this.props.institutionLevels.some((l) => l.level === levelCode);
  }

  addLevel(levelCode: EducationalLevelCode, modalityCode: EducationalModalityCode): void {
    if (!this.hasLevel(levelCode, modalityCode)) {
      this.props.institutionLevels.push({ level: levelCode, modality: modalityCode });
    }
  }

  softDelete(): void {
    this.props.active = false;
    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }
}
