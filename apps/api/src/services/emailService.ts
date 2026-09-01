export interface EmailMessage {
  to: string;
  subject: string;
  template: string;
  payload: Record<string, unknown>;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

const consoleTransport: EmailTransport = {
  async send(message) {
    console.log('Email notification (transport=console):', JSON.stringify({
      to: message.to,
      subject: message.subject,
      template: message.template,
      payload: message.payload,
    }));
  },
};

const getTransport = (): EmailTransport => {
  switch (process.env.EMAIL_TRANSPORT) {
    case 'smtp':
      console.warn('EMAIL_TRANSPORT=smtp requested but no SMTP transport is configured; falling back to console');
      return consoleTransport;
    default:
      return consoleTransport;
  }
};

export interface InviteEmailParams {
  to: string;
  teamName: string;
  inviterEmail: string;
  role: 'admin' | 'member' | 'viewer';
}

export const sendInvite = async (params: InviteEmailParams): Promise<void> => {
  await getTransport().send({
    to: params.to,
    subject: `You've been invited to join ${params.teamName}`,
    template: 'team-invite',
    payload: {
      teamName: params.teamName,
      inviterEmail: params.inviterEmail,
      role: params.role,
    },
  });
};

export interface PasswordResetEmailParams {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export const sendPasswordReset = async (params: PasswordResetEmailParams): Promise<void> => {
  await getTransport().send({
    to: params.to,
    subject: 'Reset your Runner password',
    template: 'password-reset',
    payload: {
      resetUrl: params.resetUrl,
      expiresInMinutes: params.expiresInMinutes,
    },
  });
};
