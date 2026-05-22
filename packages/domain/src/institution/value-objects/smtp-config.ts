import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

export type SmtpEncryption = 'TLS' | 'SSL' | 'NONE';

export interface SmtpConfigProps {
  host?: string;
  user?: string;
  pass?: string;
  encryption?: SmtpEncryption;
  port?: number;
}

export class SmtpConfig {
  private constructor(private readonly props: SmtpConfigProps) {}

  static create(props: SmtpConfigProps): Result<SmtpConfig, ValidationError> {
    if (props.encryption !== undefined) {
      const validEncryptions: SmtpEncryption[] = ['TLS', 'SSL', 'NONE'];
      if (!validEncryptions.includes(props.encryption as SmtpEncryption)) {
        return err(
          new ValidationError(
            `Invalid SMTP encryption: "${props.encryption}". Must be TLS, SSL, or NONE`,
          ),
        );
      }
    }

    if (props.port !== undefined && (props.port < 1 || props.port > 65535)) {
      return err(
        new ValidationError(`Invalid SMTP port: ${props.port}. Must be between 1 and 65535`),
      );
    }

    return ok(new SmtpConfig(props));
  }

  static reconstruct(props: SmtpConfigProps): SmtpConfig {
    return new SmtpConfig(props);
  }

  get host(): string | undefined {
    return this.props.host;
  }

  get user(): string | undefined {
    return this.props.user;
  }

  get pass(): string | undefined {
    return this.props.pass;
  }

  get encryption(): SmtpEncryption | undefined {
    return this.props.encryption;
  }

  get port(): number | undefined {
    return this.props.port;
  }
}
