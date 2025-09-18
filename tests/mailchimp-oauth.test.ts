/**
 * Unit tests for Mailchimp OAuth service
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MailchimpOAuthService } from '../server/services/mailchimp-oauth';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('MailchimpOAuthService', () => {
  let service: MailchimpOAuthService;

  beforeEach(() => {
    service = new MailchimpOAuthService();
    jest.clearAllMocks();

    // Mock environment variables
    process.env.MAILCHIMP_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.MAILCHIMP_OAUTH_CLIENT_SECRET = 'test-client-secret';
    process.env.APP_URL = 'http://localhost:5000';
  });

  describe('getServiceType', () => {
    it('should return "mailchimp"', () => {
      expect(service.getServiceType()).toBe('mailchimp');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate correct authorization URL', () => {
      const companyId = 123;
      const userId = 456;

      const authUrl = service.getAuthorizationUrl(companyId, userId);

      expect(authUrl).toContain('https://login.mailchimp.com/oauth2/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('redirect_uri=http%3A//localhost%3A5000/api/auth/mailchimp/callback');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'bearer',
        expires_in: 0,
        scope: 'test-scope'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      const tokens = await service.exchangeCodeForTokens('test-code', 'test-state');

      expect(tokens.access_token).toBe('test-access-token');
      expect(tokens.token_type).toBe('bearer');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://login.mailchimp.com/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('should handle token exchange errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid request',
      } as Response);

      await expect(service.exchangeCodeForTokens('invalid-code', 'test-state'))
        .rejects.toThrow('Token exchange failed: Bad Request - Invalid request');
    });
  });

  describe('getMetadata', () => {
    it('should fetch metadata successfully', async () => {
      const mockMetadata = {
        dc: 'us12',
        api_endpoint: 'https://us12.api.mailchimp.com/3.0',
        login_url: 'https://us12.admin.mailchimp.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      } as Response);

      const metadata = await service.getMetadata('test-access-token');

      expect(metadata.dc).toBe('us12');
      expect(metadata.api_endpoint).toBe('https://us12.api.mailchimp.com/3.0');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://login.mailchimp.com/oauth2/metadata',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
          }),
        })
      );
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user info successfully', async () => {
      const mockUserInfo = {
        account_id: 'test-account-id',
        login_name: 'test@example.com',
        account_name: 'Test Account',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserInfo,
      } as Response);

      const userInfo = await service.getUserInfo(
        'test-access-token',
        'https://us12.api.mailchimp.com/3.0'
      );

      expect(userInfo.account_id).toBe('test-account-id');
      expect(userInfo.account_name).toBe('Test Account');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://us12.api.mailchimp.com/3.0/',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
          }),
        })
      );
    });
  });

  describe('testApiAccess', () => {
    it('should test API access successfully', async () => {
      const mockMetadata = {
        dc: 'us12',
        api_endpoint: 'https://us12.api.mailchimp.com/3.0',
        login_url: 'https://us12.admin.mailchimp.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const isValid = await service.testApiAccess('test-access-token');

      expect(isValid).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return false for invalid tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const isValid = await service.testApiAccess(
        'invalid-token',
        'https://us12.api.mailchimp.com/3.0'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('fetchLists', () => {
    it('should fetch lists with pagination', async () => {
      const mockListsPage1 = {
        lists: [
          { id: 'list1', name: 'Test List 1' },
          { id: 'list2', name: 'Test List 2' },
        ],
        total_items: 3,
      };

      const mockListsPage2 = {
        lists: [
          { id: 'list3', name: 'Test List 3' },
        ],
        total_items: 3,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockListsPage1,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockListsPage2,
        } as Response);

      const lists = await service.fetchLists(
        'test-access-token',
        'https://us12.api.mailchimp.com/3.0',
        10
      );

      expect(lists).toHaveLength(3);
      expect(lists[0].name).toBe('Test List 1');
      expect(lists[2].name).toBe('Test List 3');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle 401 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      await expect(
        service.fetchLists(
          'invalid-token',
          'https://us12.api.mailchimp.com/3.0',
          10
        )
      ).rejects.toThrow('TOKEN_EXPIRED:401:Unauthorized');
    });
  });

  describe('fetchListMembers', () => {
    it('should fetch list members with incremental sync', async () => {
      const mockMembers = {
        members: [
          {
            id: 'member1',
            email_address: 'user1@example.com',
            status: 'subscribed',
          },
          {
            id: 'member2',
            email_address: 'user2@example.com',
            status: 'unsubscribed',
          },
        ],
        total_items: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMembers,
      } as Response);

      const members = await service.fetchListMembers(
        'test-access-token',
        'https://us12.api.mailchimp.com/3.0',
        'test-list-id',
        100,
        '2023-01-01T00:00:00Z'
      );

      expect(members).toHaveLength(2);
      expect(members[0].email_address).toBe('user1@example.com');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('since_last_changed=2023-01-01T00%3A00%3A00Z'),
        expect.any(Object)
      );
    });
  });

  describe('rate limiting', () => {
    it('should handle rate limiting with exponential backoff', async () => {
      // Mock rate limited response then successful response
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Map([['Retry-After', '2']]),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ lists: [], total_items: 0 }),
        } as Response);

      const startTime = Date.now();
      const lists = await service.fetchLists(
        'test-access-token',
        'https://us12.api.mailchimp.com/3.0',
        1
      );
      const endTime = Date.now();

      expect(lists).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Should have waited at least 2 seconds (Retry-After header)
      expect(endTime - startTime).toBeGreaterThan(1900);
    });

    it('should throw error after max retries', async () => {
      // Mock always rate limited
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map(),
      } as any);

      await expect(
        service.fetchLists(
          'test-access-token',
          'https://us12.api.mailchimp.com/3.0',
          1
        )
      ).rejects.toThrow('Rate limit exceeded after 3 retries');

      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('webhook management', () => {
    it('should create webhook successfully', async () => {
      const mockWebhook = {
        id: 'webhook-id',
        url: 'https://example.com/webhook',
        events: { subscribe: true },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWebhook,
      } as Response);

      const webhook = await service.createWebhook(
        'test-access-token',
        'https://us12.api.mailchimp.com/3.0',
        'test-list-id',
        'https://example.com/webhook'
      );

      expect(webhook.id).toBe('webhook-id');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://us12.api.mailchimp.com/3.0/lists/test-list-id/webhooks',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('https://example.com/webhook'),
        })
      );
    });

    it('should list webhooks successfully', async () => {
      const mockWebhooks = {
        webhooks: [
          { id: 'webhook1', url: 'https://example.com/webhook1' },
          { id: 'webhook2', url: 'https://example.com/webhook2' },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWebhooks,
      } as Response);

      const webhooks = await service.listWebhooks(
        'test-access-token',
        'https://us12.api.mailchimp.com/3.0',
        'test-list-id'
      );

      expect(webhooks).toHaveLength(2);
      expect(webhooks[0].id).toBe('webhook1');
    });

    it('should delete webhook successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      await expect(
        service.deleteWebhook(
          'test-access-token',
          'https://us12.api.mailchimp.com/3.0',
          'test-list-id',
          'webhook-id'
        )
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://us12.api.mailchimp.com/3.0/lists/test-list-id/webhooks/webhook-id',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('processWebhookPayload', () => {
    it('should process subscribe event correctly', async () => {
      const payload = {
        type: 'subscribe',
        data: {
          id: 'member-id',
          email: 'user@example.com',
          list_id: 'list-id',
          merges: { FNAME: 'John', LNAME: 'Doe' },
        },
      };

      const result = await service.processWebhookPayload(payload);

      expect(result.type).toBe('subscribe');
      expect(result.data.email).toBe('user@example.com');
      expect(result.data.status).toBe('subscribe');
      expect(result.data.merge_fields.FNAME).toBe('John');
      expect(result.listId).toBe('list-id');
    });

    it('should handle unknown event types', async () => {
      const payload = {
        type: 'unknown_event',
        data: { custom_field: 'value' },
      };

      const result = await service.processWebhookPayload(payload);

      expect(result.type).toBe('unknown_event');
      expect(result.data.custom_field).toBe('value');
    });
  });
});