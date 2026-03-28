import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatInstallCommand,
  formatInstallHint,
  formatSkillLink,
  runFind,
} from './find.ts';
import { stripAnsi } from './test-utils.ts';

describe('formatInstallCommand', () => {
  it('uses source@skill for repository sources', () => {
    expect(
      formatInstallCommand({
        name: 'find-skills',
        slug: 'vercel-labs/skills/find-skills',
        source: 'vercel-labs/skills',
      })
    ).toBe('vercel-labs/skills@find-skills');
  });

  it('uses add with --skill for URL sources', () => {
    expect(
      formatInstallCommand({
        name: 'skill-name',
        slug: 'public/skill-name',
        source: 'http://localhost:9080/registry/public',
      })
    ).toBe('npx skills add http://localhost:9080/registry/public --skill skill-name');
  });

  it('falls back to slug when source is missing', () => {
    expect(
      formatInstallCommand({
        name: 'my-skill',
        slug: 'owner/repo',
        source: '',
      })
    ).toBe('owner/repo@my-skill');
  });
});

describe('formatInstallHint', () => {
  it('uses a URL-based template for URL sources', () => {
    expect(
      formatInstallHint({
        slug: 'public/skill-name',
        source: 'http://localhost:9080/registry/public',
      })
    ).toBe('npx skills add http://localhost:9080/registry/public --skill skill-name');
  });

  it('uses the repository template for non-URL sources', () => {
    expect(
      formatInstallHint({
        slug: 'vercel-labs/skills/find-skills',
        source: 'vercel-labs/skills',
      })
    ).toBe('npx skills add <owner/repo@skill>');
  });
});

describe('formatSkillLink', () => {
  it('uses the concrete SKILL.md URL for URL sources', () => {
    expect(
      formatSkillLink({
        name: 'adapt',
        slug: 'adapt',
        source: 'http://localhost:9080/registry/public',
      })
    ).toBe('http://localhost:9080/registry/public/.well-known/skills/adapt/SKILL.md');
  });

  it('uses the skills.sh page for repository sources', () => {
    expect(
      formatSkillLink({
        name: 'find-skills',
        slug: 'vercel-labs/skills/find-skills',
        source: 'vercel-labs/skills',
      })
    ).toBe('https://skills.sh/vercel-labs/skills/find-skills');
  });
});

describe('runFind output', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('prints URL-source results with a single install template and concrete SKILL.md links', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [
          {
            id: 'ab-test-setup',
            name: 'ab-test-setup',
            installs: 12,
            source: 'http://localhost:9080/registry/public',
          },
          {
            id: 'webapp-testing',
            name: 'webapp-testing',
            installs: 0,
            source: 'http://localhost:9080/registry/public',
          },
        ],
      }),
    });

    await runFind(['test']);

    const output = stripAnsi(logSpy.mock.calls.flat().join('\n'));
    expect(output).toContain(
      'Install with npx skills add http://localhost:9080/registry/public --skill skill-name'
    );
    expect(output).toContain('ab-test-setup');
    expect(output).toContain('webapp-testing');
    expect(output).toContain(
      'http://localhost:9080/registry/public/.well-known/skills/ab-test-setup/SKILL.md'
    );
    expect(output).toContain(
      'http://localhost:9080/registry/public/.well-known/skills/webapp-testing/SKILL.md'
    );
    expect(output).not.toContain('http://localhost:9080/registry/public@ab-test-setup');
    expect(output).not.toContain('npx skills add http://localhost:9080/registry/public --skill ab-test-setup');
  });

  it('keeps repository-source results in owner/repo@skill format', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [
          {
            id: 'vercel-labs/skills/find-skills',
            name: 'find-skills',
            installs: 42,
            source: 'vercel-labs/skills',
          },
        ],
      }),
    });

    await runFind(['find']);

    const output = stripAnsi(logSpy.mock.calls.flat().join('\n'));
    expect(output).toContain('Install with npx skills add <owner/repo@skill>');
    expect(output).toContain('vercel-labs/skills@find-skills');
    expect(output).toContain('https://skills.sh/vercel-labs/skills/find-skills');
  });

  it('falls back to slug-based links when source is missing', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [
          {
            id: 'owner/repo/my-skill',
            name: 'my-skill',
            installs: 0,
            source: '',
          },
        ],
      }),
    });

    await runFind(['my']);

    const output = stripAnsi(logSpy.mock.calls.flat().join('\n'));
    expect(output).toContain('owner/repo/my-skill@my-skill');
    expect(output).toContain('https://skills.sh/owner/repo/my-skill');
  });

  it('shows a no-results message when search returns nothing', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ skills: [] }),
    });

    await runFind(['missing']);

    const output = stripAnsi(logSpy.mock.calls.flat().join('\n'));
    expect(output).toContain('No skills found for "missing"');
  });
});
