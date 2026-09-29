// src/github.js — Fetch commits and PRs since the previous release

/**
 * Find the tag of the release immediately preceding `currentTag`.
 * Returns null if this is the first release.
 */
async function findPreviousReleaseTag(octokit, owner, repo, currentTag) {
  const { data: releases } = await octokit.rest.repos.listReleases({
    owner,
    repo,
    per_page: 100,
  });
  // Releases come back newest-first. Find the current one, then take the next.
  const idx = releases.findIndex(r => r.tag_name === currentTag);
  if (idx === -1) return null;
  if (idx + 1 >= releases.length) return null;
  return releases[idx + 1].tag_name;
}

async function fetchCommitsSinceLastRelease(octokit, owner, repo, currentTag) {
  const prevTag = await findPreviousReleaseTag(octokit, owner, repo, currentTag);
  let sinceISO;
  if (prevTag) {
    try {
      const { data: prevRef } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `tags/${prevTag}`,
      });
      const { data: prevCommit } = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: prevRef.object.sha,
      });
      sinceISO = prevCommit.committer.date;
    } catch (err) {
      // Fallback: just take recent commits
      sinceISO = undefined;
    }
  }

  const commits = [];
  let page = 1;
  const perPage = 100;
  // Cap at 500 commits to keep LLM context sane
  while (commits.length < 500) {
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: perPage,
      page,
      since: sinceISO,
    });
    if (!data.length) break;
    commits.push(...data.map(c => ({
      sha: c.sha,
      message: c.commit.message.split('\n')[0],
      author: c.commit.author?.name || 'unknown',
      date: c.commit.author?.date,
      url: c.html_url,
    })));
    if (data.length < perPage) break;
    page++;
  }
  return commits;
}

async function fetchPullRequestsSinceLastRelease(octokit, owner, repo, currentTag) {
  const prevTag = await findPreviousReleaseTag(octokit, owner, repo, currentTag);
  let sinceISO;
  if (prevTag) {
    try {
      const { data: prevRef } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `tags/${prevTag}`,
      });
      const { data: prevCommit } = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: prevRef.object.sha,
      });
      sinceISO = prevCommit.committer.date;
    } catch (err) {
      sinceISO = undefined;
    }
  }

  const prs = [];
  let page = 1;
  const perPage = 100;
  while (prs.length < 200) {
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: perPage,
      page,
    });
    if (!data.length) break;
    for (const pr of data) {
      if (sinceISO && new Date(pr.merged_at || pr.updated_at) < new Date(sinceISO)) {
        return prs; // We've gone past the cutoff
      }
      if (!pr.merged_at) continue; // Skip unmerged
      prs.push({
        number: pr.number,
        title: pr.title,
        body: (pr.body || '').slice(0, 500),
        user: pr.user?.login || 'unknown',
        url: pr.html_url,
        labels: pr.labels?.map(l => l.name) || [],
      });
    }
    if (data.length < perPage) break;
    page++;
  }
  return prs;
}

module.exports = {
  fetchCommitsSinceLastRelease,
  fetchPullRequestsSinceLastRelease,
  findPreviousReleaseTag,
};
