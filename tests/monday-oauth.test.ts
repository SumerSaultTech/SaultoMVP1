/**
 * Unit tests for Monday.com OAuth service with GraphQL support
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MondayOAuthService } from '../server/services/monday-oauth';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('MondayOAuthService', () => {
  let service: MondayOAuthService;

  beforeEach(() => {
    service = new MondayOAuthService();
    jest.clearAllMocks();

    // Mock environment variables
    process.env.MONDAY_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.MONDAY_OAUTH_CLIENT_SECRET = 'test-client-secret';
    process.env.APP_URL = 'http://localhost:5000';
  });

  describe('getServiceType', () => {
    it('should return "monday"', () => {
      expect(service.getServiceType()).toBe('monday');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate correct authorization URL with scopes', () => {
      const companyId = 123;
      const userId = 456;

      const authUrl = service.getAuthorizationUrl(companyId, userId);

      expect(authUrl).toContain('https://auth.monday.com/oauth2/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('redirect_uri=http%3A//localhost%3A5000/api/auth/monday/callback');
      expect(authUrl).toContain('scope=boards%3Aread%20users%3Aread%20teams%3Aread%20updates%3Aread%20assets%3Aread%20me%3Aread');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        scope: 'boards:read users:read'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      const tokens = await service.exchangeCodeForTokens('test-code', 'test-state');

      expect(tokens.access_token).toBe('test-access-token');
      expect(tokens.refresh_token).toBe('test-refresh-token');
      expect(tokens.expires_in).toBe(3600);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.monday.com/oauth2/token',
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

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'bearer'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefreshResponse,
      } as Response);

      const tokens = await service.refreshToken('test-refresh-token');

      expect(tokens.access_token).toBe('new-access-token');
      expect(tokens.refresh_token).toBe('new-refresh-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.monday.com/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('grant_type=refresh_token'),
        })
      );
    });
  });

  describe('GraphQL executeGraphQLQuery', () => {
    it('should execute GraphQL query successfully', async () => {
      const mockGraphQLResponse = {
        data: {
          me: {
            id: '12345',
            name: 'Test User',
            email: 'test@example.com'
          }
        },
        extensions: {
          complexity: {
            before: 100,
            after: 90,
            query: 10
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGraphQLResponse,
      } as Response);

      const userInfo = await service.getUserInfo('test-access-token');

      expect(userInfo.id).toBe('12345');
      expect(userInfo.name).toBe('Test User');
      expect(userInfo.email).toBe('test@example.com');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.monday.com/v2',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('query'),
        })
      );
    });

    it('should handle GraphQL errors', async () => {
      const mockErrorResponse = {
        errors: [
          {
            message: 'Field "invalidField" does not exist',
            locations: [{ line: 2, column: 3 }],
            path: ['me']
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockErrorResponse,
      } as Response);

      await expect(service.getUserInfo('test-access-token'))
        .rejects.toThrow('GraphQL errors: Field "invalidField" does not exist');
    });

    it('should handle 429 rate limiting with retry', async () => {
      const mockSuccessResponse = {
        data: {
          me: {
            id: '12345',
            name: 'Test User',
            email: 'test@example.com'
          }
        }
      };

      // First call returns 429, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Map([['Retry-After', '2']]),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSuccessResponse,
        } as Response);

      const startTime = Date.now();
      const userInfo = await service.getUserInfo('test-access-token');
      const endTime = Date.now();

      expect(userInfo.id).toBe('12345');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Should have waited at least 2 seconds (Retry-After header)
      expect(endTime - startTime).toBeGreaterThan(1900);
    });

    it('should handle complexity tracking', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const mockComplexityResponse = {
        data: { boards: [] },
        extensions: {
          complexity: {
            before: 1000,
            after: 950,
            query: 50
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockComplexityResponse,
      } as Response);

      await service.fetchBoards('test-access-token', 10, 1);

      expect(consoleSpy).toHaveBeenCalledWith(
        '📊 Monday.com complexity: 50 points (1000 → 950)'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('testApiAccess', () => {
    it('should test API access successfully', async () => {
      const mockResponse = {
        data: {
          me: {
            id: '12345',
            name: 'Test User'
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const isValid = await service.testApiAccess('test-access-token');

      expect(isValid).toBe(true);
    });

    it('should return false for invalid tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const isValid = await service.testApiAccess('invalid-token');

      expect(isValid).toBe(false);
    });
  });

  describe('fetchBoards', () => {
    it('should fetch boards with GraphQL', async () => {
      const mockBoardsResponse = {
        data: {
          boards: [
            {
              id: '12345',
              name: 'Test Board 1',
              description: 'Test description',
              state: 'active',
              board_kind: 'public',
              created_at: '2023-01-01T00:00:00Z',
              updated_at: '2023-01-02T00:00:00Z',
              workspace: { id: 'ws1', name: 'Test Workspace' },
              owners: [{ id: 'user1', name: 'Owner 1', email: 'owner@test.com' }],
              permissions: 'everyone'
            },
            {
              id: '67890',
              name: 'Test Board 2',
              description: null,
              state: 'archived',
              board_kind: 'private',
              created_at: '2023-02-01T00:00:00Z',
              updated_at: '2023-02-02T00:00:00Z',
              workspace: { id: 'ws2', name: 'Another Workspace' },
              owners: [{ id: 'user2', name: 'Owner 2', email: 'owner2@test.com' }],
              permissions: 'subscribers'
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBoardsResponse,
      } as Response);

      const boards = await service.fetchBoards('test-access-token', 10, 1);

      expect(boards).toHaveLength(2);
      expect(boards[0].name).toBe('Test Board 1');
      expect(boards[0].state).toBe('active');
      expect(boards[1].name).toBe('Test Board 2');
      expect(boards[1].state).toBe('archived');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.monday.com/v2',
        expect.objectContaining({
          body: expect.stringContaining('boards(limit: $limit, page: $page)'),
        })
      );
    });

    it('should handle 401 errors for boards', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      await expect(
        service.fetchBoards('invalid-token', 10, 1)
      ).rejects.toThrow('TOKEN_EXPIRED:401:Unauthorized');
    });
  });

  describe('fetchUsers', () => {
    it('should fetch users with GraphQL', async () => {
      const mockUsersResponse = {
        data: {
          users: [
            {
              id: 'user1',
              name: 'John Doe',
              email: 'john@example.com',
              title: 'Developer',
              phone: '123-456-7890',
              mobile_phone: '098-765-4321',
              is_admin: true,
              is_guest: false,
              enabled: true,
              created_at: '2023-01-01T00:00:00Z',
              last_activity: '2023-12-01T00:00:00Z',
              photo_thumb: 'https://example.com/photo.jpg',
              timezone: 'America/New_York',
              location: 'New York',
              account: { id: 'acc1', name: 'Test Account' },
              teams: [{ id: 'team1', name: 'Dev Team' }]
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUsersResponse,
      } as Response);

      const users = await service.fetchUsers('test-access-token', 10, 1);

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('John Doe');
      expect(users[0].email).toBe('john@example.com');
      expect(users[0].is_admin).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.monday.com/v2',
        expect.objectContaining({
          body: expect.stringContaining('users(limit: $limit, page: $page)'),
        })
      );
    });
  });

  describe('fetchItems', () => {
    it('should fetch items from boards with GraphQL', async () => {
      const mockItemsResponse = {
        data: {
          boards: [
            {
              id: 'board1',
              name: 'Test Board',
              items: [
                {
                  id: 'item1',
                  name: 'Test Item 1',
                  state: 'active',
                  created_at: '2023-01-01T00:00:00Z',
                  updated_at: '2023-01-02T00:00:00Z',
                  creator_id: 'user1',
                  creator: { id: 'user1', name: 'John Doe', email: 'john@example.com' },
                  board: { id: 'board1', name: 'Test Board' },
                  column_values: [
                    {
                      id: 'col1',
                      text: 'High',
                      value: '{"index": 1}',
                      column: { id: 'col1', title: 'Priority', type: 'status' }
                    }
                  ]
                }
              ]
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItemsResponse,
      } as Response);

      const items = await service.fetchItems('test-access-token', ['board1'], 10, 1);

      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Test Item 1');
      expect(items[0].creator.name).toBe('John Doe');
      expect(items[0].column_values).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.monday.com/v2',
        expect.objectContaining({
          body: expect.stringContaining('boards(ids: $boardIds)'),
        })
      );
    });

    it('should filter items by newerThan parameter', async () => {
      const mockItemsResponse = {
        data: {
          boards: [
            {
              id: 'board1',
              name: 'Test Board',
              items: [
                {
                  id: 'item1',
                  name: 'Old Item',
                  updated_at: '2023-01-01T00:00:00Z'
                },
                {
                  id: 'item2',
                  name: 'New Item',
                  updated_at: '2023-12-01T00:00:00Z'
                }
              ]
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockItemsResponse,
      } as Response);

      const items = await service.fetchItems(
        'test-access-token',
        ['board1'],
        10,
        1,
        '2023-06-01T00:00:00Z'
      );

      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('New Item');
    });
  });

  describe('fetchUpdates', () => {
    it('should fetch updates from boards with GraphQL', async () => {
      const mockUpdatesResponse = {
        data: {
          boards: [
            {
              id: 'board1',
              name: 'Test Board',
              updates: [
                {
                  id: 'update1',
                  body: 'Test update content',
                  text_body: 'Test update content (text)',
                  created_at: '2023-01-01T00:00:00Z',
                  updated_at: '2023-01-02T00:00:00Z',
                  creator_id: 'user1',
                  creator: { id: 'user1', name: 'John Doe', email: 'john@example.com' },
                  replies: [
                    {
                      id: 'reply1',
                      body: 'Reply content',
                      created_at: '2023-01-03T00:00:00Z',
                      creator_id: 'user2'
                    }
                  ],
                  assets: [
                    {
                      id: 'asset1',
                      name: 'document.pdf',
                      url: 'https://example.com/document.pdf',
                      file_extension: 'pdf',
                      file_size: 1024
                    }
                  ]
                }
              ]
            }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdatesResponse,
      } as Response);

      const updates = await service.fetchUpdates('test-access-token', ['board1'], 10, 1);

      expect(updates).toHaveLength(1);
      expect(updates[0].body).toBe('Test update content');
      expect(updates[0].creator.name).toBe('John Doe');
      expect(updates[0].replies).toHaveLength(1);
      expect(updates[0].assets).toHaveLength(1);
    });
  });

  describe('webhook management', () => {
    it('should create webhook successfully', async () => {
      const mockWebhookResponse = {
        data: {
          create_webhook: {
            id: 'webhook-id',
            board_id: 'board1',
            config: JSON.stringify({ url: 'https://example.com/webhook' })
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWebhookResponse,
      } as Response);

      const webhook = await service.createWebhook(
        'test-access-token',
        'board1',
        'https://example.com/webhook'
      );

      expect(webhook.id).toBe('webhook-id');
      expect(webhook.board_id).toBe('board1');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.monday.com/v2',
        expect.objectContaining({
          body: expect.stringContaining('create_webhook'),
        })
      );
    });

    it('should delete webhook successfully', async () => {
      const mockDeleteResponse = {
        data: {
          delete_webhook: {
            id: 'webhook-id'
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeleteResponse,
      } as Response);

      await expect(
        service.deleteWebhook('test-access-token', 'webhook-id')
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.monday.com/v2',
        expect.objectContaining({
          body: expect.stringContaining('delete_webhook'),
        })
      );
    });
  });

  describe('processWebhookPayload', () => {
    it('should process item creation event correctly', async () => {
      const payload = {
        type: 'create_item',
        data: {
          item_id: 'item123',
          item_name: 'New Task',
          board_id: 'board456',
          user_id: 'user789'
        }
      };

      const result = await service.processWebhookPayload(payload);

      expect(result.type).toBe('create_item');
      expect(result.data.id).toBe('item123');
      expect(result.data.name).toBe('New Task');
      expect(result.data.board_id).toBe('board456');
      expect(result.data.event_type).toBe('create_item');
      expect(result.boardId).toBe('board456');
    });

    it('should process column value change event', async () => {
      const payload = {
        type: 'change_column_value',
        data: {
          pulseId: 'item123',
          pulseName: 'Task Name',
          boardId: 'board456',
          column_id: 'status',
          value: 'Done',
          previous_value: 'In Progress',
          userId: 'user789'
        }
      };

      const result = await service.processWebhookPayload(payload);

      expect(result.type).toBe('change_column_value');
      expect(result.data.id).toBe('item123');
      expect(result.data.name).toBe('Task Name');
      expect(result.data.value).toBe('Done');
      expect(result.data.previous_value).toBe('In Progress');
    });

    it('should handle unknown event types', async () => {
      const payload = {
        type: 'unknown_event',
        data: { custom_field: 'value' }
      };

      const result = await service.processWebhookPayload(payload);

      expect(result.type).toBe('unknown_event');
      expect(result.data.custom_field).toBe('value');
    });
  });

  describe('discoverTables', () => {
    it('should discover Monday.com tables', async () => {
      // Mock multiple GraphQL responses for table discovery
      const mockResponses = [
        { data: { boards: [{ id: '1', name: 'Test' }] } },
        { data: { users: [{ id: '1', name: 'User' }] } },
        { data: { boards: [{ items: [{ id: '1', name: 'Item' }] }] } },
        { data: { boards: [{ updates: [{ id: '1', body: 'Update' }] }] } },
        { data: { teams: [{ id: '1', name: 'Team' }] } },
        { data: { workspaces: [{ id: '1', name: 'Workspace' }] } },
        { data: { tags: [{ id: '1', name: 'Tag' }] } }
      ];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponses[0] } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponses[1] } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponses[2] } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponses[3] } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponses[4] } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponses[5] } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponses[6] } as Response);

      const tables = await service.discoverTables('test-access-token');

      expect(tables.length).toBeGreaterThan(0);
      expect(tables.some(t => t.name === 'boards')).toBe(true);
      expect(tables.some(t => t.name === 'users')).toBe(true);
      expect(tables.some(t => t.name === 'items')).toBe(true);
      expect(tables.some(t => t.name === 'updates')).toBe(true);
    });
  });
});