document.addEventListener('DOMContentLoaded', () => {
    const rankingList = document.getElementById('ranking-list');
    const searchBar = document.getElementById('search-bar');
    const totalFandomsEl = document.getElementById('total-fandoms');
    const totalCreatorsEl = document.getElementById('total-creators');
    
    let allFandoms = [];
    
    // Load Data
    fetch('data/creator-data.json')
        .then(response => response.json())
        .then(data => {
            processData(data);
        })
        .catch(error => {
            console.error('Error loading data:', error);
            rankingList.innerHTML = '<li class="loading">Error loading data. Please try again.</li>';
        });

    function processData(data) {
        const creators = data.creators || [];
        const fandomCounts = {};
        let processedCreatorsCount = 0;

        creators.forEach(creator => {
            processedCreatorsCount++;
            if (creator.fandoms && Array.isArray(creator.fandoms)) {
                creator.fandoms.forEach(fandom => {
                    // Normalize string: trim whitespace
                    const normalizedFandom = fandom.trim();
                    if (normalizedFandom) {
                        fandomCounts[normalizedFandom] = (fandomCounts[normalizedFandom] || 0) + 1;
                    }
                });
            }
        });

        // Convert to array and sort
        allFandoms = Object.keys(fandomCounts).map(name => ({
            name: name,
            count: fandomCounts[name]
        }));

        // Sort by count (descending), then name (alphabetical)
        allFandoms.sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.name.localeCompare(b.name);
        });

        // Assign ranks with tie handling
        let currentRank = 1;
        for (let i = 0; i < allFandoms.length; i++) {
            if (i > 0 && allFandoms[i].count < allFandoms[i-1].count) {
                currentRank = i + 1;
            }
            allFandoms[i].rank = currentRank;
        }

        // Update Stats
        totalFandomsEl.textContent = allFandoms.length.toLocaleString();
        totalCreatorsEl.textContent = processedCreatorsCount.toLocaleString();

        // Render Initial Views
        renderRankingList(allFandoms);
        renderChart(allFandoms.slice(0, 15)); // Top 15 for chart
    }

    function renderRankingList(fandoms) {
        rankingList.innerHTML = '';
        
        if (fandoms.length === 0) {
            rankingList.innerHTML = '<li class="loading">No fandoms found.</li>';
            return;
        }

        fandoms.forEach((fandom) => {
            const li = document.createElement('li');
            li.className = `ranking-item rank-${fandom.rank}`;
            
            li.innerHTML = `
                <span class="rank-number">#${fandom.rank}</span>
                <span class="fandom-name">${escapeHtml(fandom.name)}</span>
                <span class="creator-count">${fandom.count}</span>
            `;
            
            rankingList.appendChild(li);
        });
    }

    function renderChart(topFandoms) {
        const ctx = document.getElementById('fandomChart').getContext('2d');
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topFandoms.map(f => f.name),
                datasets: [{
                    label: 'Number of Creators',
                    data: topFandoms.map(f => f.count),
                    backgroundColor: 'rgba(108, 92, 231, 0.6)',
                    borderColor: 'rgba(108, 92, 231, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Search Functionality
    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = allFandoms.filter(f => 
            f.name.toLowerCase().includes(searchTerm)
        );
        renderRankingList(filtered);
    });

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});

