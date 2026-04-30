document.addEventListener('DOMContentLoaded', () => {
    const rankingList = document.getElementById('ranking-list');
    const searchBar = document.getElementById('search-bar');
    const totalFandomsEl = document.getElementById('total-fandoms');
    const totalCreatorsEl = document.getElementById('total-creators');
    const footerSource = document.getElementById('footer-source');
    const btnCf22 = document.getElementById('btn-cf22');
    const btnCf21 = document.getElementById('btn-cf21');

    const DATA_SOURCES = {
        cf22: 'https://cf22-config.nnt.gg/data/creator-data.json',
        cf21: 'data/creator-data.json'
    };

    const FOOTER_LABELS = {
        cf22: 'Data sourced from Comifuro 22 Creator List',
        cf21: 'Data sourced from Comifuro 21 Creator List'
    };

    let allFandoms = [];
    let currentDataset = 'cf22';
    let currentFilter = 'all';
    let cf21RankMap = null;

    function loadData(dataset) {
        rankingList.innerHTML = '<li class="loading">Loading data...</li>';
        totalFandomsEl.textContent = '-';
        totalCreatorsEl.textContent = '-';
        footerSource.textContent = FOOTER_LABELS[dataset];

        const url = dataset === 'cf22'
            ? `${DATA_SOURCES[dataset]}?v=${Math.random().toString(36).slice(2)}`
            : DATA_SOURCES[dataset];

        fetch(url)
            .then(response => response.json())
            .then(data => {
                processData(data);
            })
            .catch(error => {
                console.error('Error loading data:', error);
                rankingList.innerHTML = '<li class="loading">Error loading data. Please try again.</li>';
            });
    }

    function writeVarInt(bytes, value) {
        while (value >= 128) {
            bytes.push((value & 0x7F) | 0x80);
            value >>>= 7;
        }
        bytes.push(value & 0x7F);
    }

    function intsToStringCode(ints) {
        if (ints.length === 0) return '';
        const sorted = [...ints].sort((a, b) => a - b);
        const bytes = [];
        writeVarInt(bytes, sorted[0]);
        for (let i = 1; i < sorted.length; i++) {
            writeVarInt(bytes, sorted[i] - sorted[i - 1]);
        }
        const binary = Array.from(new Uint8Array(bytes)).map(b => String.fromCharCode(b)).join('');
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    function processData(data) {
        const creators = data.creators || [];
        const fandomCounts = {};
        const fandomCreatorIds = {};
        let processedCreatorsCount = 0;

        creators.forEach(creator => {
            processedCreatorsCount++;
            if (creator.fandoms && Array.isArray(creator.fandoms)) {
                creator.fandoms.forEach(fandom => {
                    const normalizedFandom = fandom.trim();
                    if (normalizedFandom) {
                        fandomCounts[normalizedFandom] = (fandomCounts[normalizedFandom] || 0) + 1;
                        if (!fandomCreatorIds[normalizedFandom]) fandomCreatorIds[normalizedFandom] = [];
                        if (creator.id != null) fandomCreatorIds[normalizedFandom].push(creator.id);
                    }
                });
            }
        });

        allFandoms = Object.keys(fandomCounts).map(name => ({
            name: name,
            count: fandomCounts[name],
            creatorIds: fandomCreatorIds[name] || []
        }));

        allFandoms.sort((a, b) => {
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.name.localeCompare(b.name);
        });

        let currentRank = 1;
        for (let i = 0; i < allFandoms.length; i++) {
            if (i > 0 && allFandoms[i].count < allFandoms[i-1].count) {
                currentRank = i + 1;
            }
            allFandoms[i].rank = currentRank;
        }

        totalFandomsEl.textContent = allFandoms.length.toLocaleString();
        totalCreatorsEl.textContent = processedCreatorsCount.toLocaleString();

        renderRankingList(applyFilters());
    }

    function applyFilters() {
        const searchTerm = searchBar.value.toLowerCase();
        return allFandoms.filter(f => {
            if (searchTerm && !f.name.toLowerCase().includes(searchTerm)) return false;
            if (currentDataset !== 'cf22' || cf21RankMap === null || currentFilter === 'all') return true;
            const cf21Rank = cf21RankMap[f.name]?.rank;
            if (currentFilter === 'new')  return cf21Rank === undefined;
            if (currentFilter === 'up')   return cf21Rank !== undefined && (cf21Rank - f.rank) > 0;
            if (currentFilter === 'down') return cf21Rank !== undefined && (cf21Rank - f.rank) < 0;
            return true;
        });
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
            li.style.cursor = 'pointer';

            let deltaBadge = '<span class="rank-delta"></span>';
            let countBadge = '<span class="count-delta"></span>';
            if (currentDataset === 'cf22' && cf21RankMap !== null) {
                const cf21 = cf21RankMap[fandom.name];
                const cf21Rank = cf21?.rank;
                if (cf21Rank === undefined) {
                    deltaBadge = `<span class="rank-delta rank-new">NEW</span>`;
                    countBadge = `<span class="count-delta count-new">+${fandom.count}</span>`;
                } else {
                    const rankDiff = cf21Rank - fandom.rank;
                    if (rankDiff > 0)      deltaBadge = `<span class="rank-delta rank-up">↑${rankDiff}</span>`;
                    else if (rankDiff < 0) deltaBadge = `<span class="rank-delta rank-down">↓${Math.abs(rankDiff)}</span>`;
                    else                   deltaBadge = `<span class="rank-delta rank-same">—</span>`;

                    const countDiff = fandom.count - cf21.count;
                    if (countDiff > 0)      countBadge = `<span class="count-delta count-up">+${countDiff}</span>`;
                    else if (countDiff < 0) countBadge = `<span class="count-delta count-down">${countDiff}</span>`;
                    else                    countBadge = `<span class="count-delta count-same">—</span>`;
                }
            }

            li.innerHTML = `
                ${deltaBadge}
                <span class="rank-number">#${fandom.rank}</span>
                <span class="fandom-name">${escapeHtml(fandom.name)}</span>
                <span class="creator-count">${fandom.count}</span>
                ${countBadge}
            `;

            li.addEventListener('click', () => {
                const listCode = intsToStringCode(fandom.creatorIds);
                const baseUrl = currentDataset === 'cf22' ? 'https://cf22.nnt.gg' : 'https://cf21.nnt.gg';
                window.open(`${baseUrl}/?list=${listCode}&source=cf-fandom`, '_blank');
            });

            rankingList.appendChild(li);
        });
    }

    function switchDataset(dataset) {
        if (dataset === currentDataset) return;
        currentDataset = dataset;

        btnCf22.classList.toggle('active', dataset === 'cf22');
        btnCf21.classList.toggle('active', dataset === 'cf21');
        document.getElementById('rankings').classList.toggle('show-comparison', dataset === 'cf22');

        searchBar.value = '';
        currentFilter = 'all';
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
        loadData(dataset);
    }

    function buildRankMap(data) {
        const creators = data.creators || [];
        const counts = {};
        creators.forEach(creator => {
            if (creator.fandoms && Array.isArray(creator.fandoms)) {
                creator.fandoms.forEach(fandom => {
                    const name = fandom.trim();
                    if (name) counts[name] = (counts[name] || 0) + 1;
                });
            }
        });
        const sorted = Object.keys(counts).sort((a, b) => {
            if (counts[b] !== counts[a]) return counts[b] - counts[a];
            return a.localeCompare(b);
        });
        const map = {};
        let currentRank = 1;
        for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && counts[sorted[i]] < counts[sorted[i - 1]]) currentRank = i + 1;
            map[sorted[i]] = { rank: currentRank, count: counts[sorted[i]] };
        }
        return map;
    }

    function loadCf21RankMap() {
        fetch(DATA_SOURCES.cf21)
            .then(r => r.json())
            .then(data => { cf21RankMap = buildRankMap(data); })
            .catch(err => console.warn('CF21 comparison data unavailable:', err));
    }

    btnCf22.addEventListener('click', () => switchDataset('cf22'));
    btnCf21.addEventListener('click', () => switchDataset('cf21'));

    searchBar.addEventListener('input', () => renderRankingList(applyFilters()));

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderRankingList(applyFilters());
        });
    });

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    loadCf21RankMap();
    document.getElementById('rankings').classList.add('show-comparison');
    loadData('cf22');
});
