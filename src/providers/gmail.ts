import { getStoredToken } from "../auth/oauth.js";
import type { ProviderAdapter, ProviderMessage, ProviderMessageDetail } from "./base.js";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export class GmailProvider implements ProviderAdapter {
  private email: string;
  private labelCache: Map<string, string> = new Map();

  constructor(email: string) {
    this.email = email;
  }

  private async request<T>(path: string): Promise<T> {
    const token = await getStoredToken(this.email);
    if (!token) throw new Error(`Not authenticated for ${this.email}`);

    const response = await fetch(`${GMAIL_API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gmail API error: ${response.status} ${text}`);
    }

    return response.json();
  }

  private async requestPost<T>(path: string, body: object): Promise<T> {
    const token = await getStoredToken(this.email);
    if (!token) throw new Error(`Not authenticated for ${this.email}`);

    const response = await fetch(`${GMAIL_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gmail API error: ${response.status} ${text}`);
    }

    return response.json();
  }

  async getMessages(days: number): Promise<ProviderMessage[]> {
    const after = Math.floor(
      (Date.now() - days * 24 * 60 * 60 * 1000) / 1000
    );
    
    const allMessageIds: { id: string }[] = [];
    let pageToken: string | undefined;

    do {
      const listData = await this.request<{ 
        messages: { id: string }[]; 
        nextPageToken?: string;
      }>(`/users/me/messages?maxResults=100&q=after:${after}${pageToken ? `&pageToken=${pageToken}` : ""}`);

      if (listData.messages) {
        allMessageIds.push(...listData.messages);
      }
      pageToken = listData.nextPageToken;
    } while (pageToken);

    const messages: ProviderMessage[] = [];
    for (const msg of allMessageIds) {
      const data = await this.request<{
        id: string;
        threadId: string;
        labelIds?: string[];
        payload?: {
          headers?: { name: string; value: string }[];
          body?: { data?: string };
          parts?: { mimeType: string; body?: { data?: string } }[];
        };
        snippet?: string;
        internalDate?: string;
      }>(`/users/me/messages/${msg.id}`);

      const headers = data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name)?.value;

      const fromHeader = getHeader("from") || "";
      const fromMatch = fromHeader.match(/(?:"?([^"]*)"?\s)?<?(.+?@[^>]+)>?/);

      messages.push({
        id: data.id,
        threadId: data.threadId,
        subject: getHeader("subject") || null,
        fromEmail: fromMatch?.[2] || fromHeader || null,
        fromName: fromMatch?.[1] || null,
        snippet: data.snippet || null,
        receivedAt: data.internalDate
          ? new Date(parseInt(data.internalDate))
          : null,
        isRead: !data.labelIds?.includes("UNREAD"),
        labelIds: data.labelIds || [],
      });
    }

    return messages;
  }

  async getMessage(id: string): Promise<ProviderMessageDetail> {
    const data = await this.request<{
      id: string;
      threadId: string;
      labelIds?: string[];
      payload?: {
        headers?: { name: string; value: string }[];
        body?: { data?: string };
        parts?: { mimeType: string; body?: { data?: string } }[];
      };
      snippet?: string;
      internalDate?: string;
    }>(`/users/me/messages/${id}`);

    const headers = data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name)?.value;

    const fromHeader = getHeader("from") || "";
    const fromMatch = fromHeader.match(/(?:"?([^"]*)"?\s)?<?(.+?@[^>]+)>?/);

    const getBody = (): string | null => {
      if (data.payload?.body?.data) {
        return Buffer.from(data.payload.body.data, "base64").toString("utf-8");
      }
      const textPart = data.payload?.parts?.find(
        (p) => p.mimeType === "text/plain"
      );
      if (textPart?.body?.data) {
        return Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
      return null;
    };

    return {
      id: data.id,
      threadId: data.threadId,
      subject: getHeader("subject") || null,
      fromEmail: fromMatch?.[2] || fromHeader || null,
      fromName: fromMatch?.[1] || null,
      snippet: data.snippet || null,
      receivedAt: data.internalDate
        ? new Date(parseInt(data.internalDate))
        : null,
      isRead: !data.labelIds?.includes("UNREAD"),
      labelIds: data.labelIds || [],
      body: getBody(),
    };
  }

  private async loadLabels(): Promise<void> {
    if (this.labelCache.size > 0) return;

    const data = await this.request<{
      labels: { id: string; name: string }[];
    }>("/users/me/labels");

    for (const label of data.labels || []) {
      this.labelCache.set(label.name, label.id);
      this.labelCache.set(label.id, label.id);
    }
  }

  async ensureLabelExists(labelName: string): Promise<string> {
    await this.loadLabels();

    const existingId = this.labelCache.get(labelName);
    if (existingId) return existingId;

    const data = await this.requestPost<{ id: string; name: string }>(
      "/users/me/labels",
      { name: labelName, labelListVisibility: "labelShow", messageListVisibility: "show" }
    );

    this.labelCache.set(labelName, data.id);
    this.labelCache.set(data.id, data.id);
    return data.id;
  }

  async addLabel(messageId: string, labelName: string): Promise<void> {
    const labelId = await this.ensureLabelExists(labelName);
    await this.requestPost(`/users/me/messages/${messageId}/modify`, {
      addLabelIds: [labelId],
    });
  }

  async removeLabel(messageId: string, labelName: string): Promise<void> {
    await this.loadLabels();
    const labelId = this.labelCache.get(labelName);
    if (!labelId) return;

    await this.requestPost(`/users/me/messages/${messageId}/modify`, {
      removeLabelIds: [labelId],
    });
  }

  async archive(messageId: string): Promise<void> {
    await this.requestPost(`/users/me/messages/${messageId}/modify`, {
      removeLabelIds: ["INBOX"],
    });
  }

  async delete(messageId: string): Promise<void> {
    const token = await getStoredToken(this.email);
    if (!token) throw new Error(`Not authenticated for ${this.email}`);

    const response = await fetch(`${GMAIL_API}/users/me/messages/${messageId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gmail API error: ${response.status} ${text}`);
    }
  }
}
