#!/usr/bin/env node
/**
 * WaleedOS GitHub Sync Script
 * 
 * Fetches repo metadata from GitHub API and updates products.json.
 * Run: node scripts/sync_products_from_github.js
 * 
 * Note: For authenticated requests (higher rate limits), set GITHUB_TOKEN env var.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_USER = 'WaleedaRaza';
const DATA_PATH = path.join(__dirname, '..', 'data', 'products.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'github_repos.json');

// Fetch repos from GitHub API
function fetchRepos() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`,
      method: 'GET',
      headers: {
        'User-Agent': 'WaleedOS-Sync',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    
    // Add auth token if available
    if (process.env.GITHUB_TOKEN) {
      options.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse GitHub response'));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log(`Fetching repos for ${GITHUB_USER}...`);
  
  try {
    const repos = await fetchRepos();
    
    if (!Array.isArray(repos)) {
      console.error('API error:', repos.message || 'Unknown error');
      console.log('Note: GitHub API has rate limits. For higher limits, set GITHUB_TOKEN env var.');
      return;
    }
    
    console.log(`Found ${repos.length} repos\n`);
    
    // Process repos
    const processed = repos.map(repo => ({
      name: repo.name,
      description: repo.description,
      language: repo.language,
      url: repo.html_url,
      pushedAt: repo.pushed_at,
      createdAt: repo.created_at,
      stars: repo.stargazers_count,
      archived: repo.archived,
      fork: repo.fork
    }));
    
    // Save raw GitHub data
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ 
      fetchedAt: new Date().toISOString(),
      repos: processed 
    }, null, 2));
    console.log(`Saved raw GitHub data to data/github_repos.json`);
    
    // Read existing products.json
    if (fs.existsSync(DATA_PATH)) {
      const productsData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
      
      // Update tech and status based on repo data
      let updated = 0;
      for (const product of productsData.products) {
        // Find matching repo
        const repoUrl = product.proof?.repo;
        if (repoUrl) {
          const repoName = repoUrl.split('/').pop();
          const repo = processed.find(r => r.name.toLowerCase() === repoName.toLowerCase());
          
          if (repo) {
            // Update language if not set
            if (repo.language && !product.tech.includes(repo.language)) {
              // Don't overwrite, just note it
              console.log(`  ${product.id}: Found language ${repo.language}`);
            }
            
            // Update archived status
            if (repo.archived && product.status !== 'Archived') {
              console.log(`  ${product.id}: Repo is archived on GitHub`);
            }
            
            updated++;
          }
        }
      }
      
      console.log(`\nMatched ${updated} products with GitHub repos`);
    }
    
    // List repos not in products.json
    console.log('\n--- Repos not yet in products.json ---');
    const productsData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const knownRepos = productsData.products
      .filter(p => p.proof?.repo)
      .map(p => p.proof.repo.split('/').pop().toLowerCase());
    
    const unmapped = processed
      .filter(r => !r.fork && !r.archived)
      .filter(r => !knownRepos.includes(r.name.toLowerCase()));
    
    if (unmapped.length > 0) {
      console.log('Consider adding these to products.json:');
      unmapped.forEach(r => {
        console.log(`  - ${r.name} (${r.language || 'no language'}) - ${r.description || 'no description'}`);
      });
    } else {
      console.log('All non-fork, non-archived repos are mapped!');
    }
    
    console.log('\n✓ Sync complete');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();



