export type SmtpRow = {
  purpose: string; host: string | null; port: number; encryption: string; username: string | null;
  password_encrypted: string | null; sender_name: string | null; sender_email: string | null; is_enabled: boolean;
  last_test_ok?: boolean | null;
};
