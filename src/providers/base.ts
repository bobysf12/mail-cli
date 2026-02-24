export interface ProviderAdapter {
  getMessages(days: number): Promise<ProviderMessage[]>;
  getMessage(id: string): Promise<ProviderMessageDetail>;
  addLabel(messageId: string, labelName: string): Promise<void>;
  removeLabel(messageId: string, labelName: string): Promise<void>;
  archive(messageId: string): Promise<void>;
  delete(messageId: string): Promise<void>;
  ensureLabelExists(labelName: string): Promise<string>;
}

export interface ProviderMessage {
  id: string;
  threadId: string;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  snippet: string | null;
  receivedAt: Date | null;
  isRead: boolean;
  labelIds: string[];
}

export interface ProviderMessageDetail extends ProviderMessage {
  body: string | null;
}
