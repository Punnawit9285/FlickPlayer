/**
 * Flickemon UI Components (Chrome Extension)
 * ───────────────────────────────────────────
 * Port of flickemon-widget.component.ts, flickemon-modal.component.ts,
 * flickemon-starter.component.ts, and flickemon-settings-modal.component.ts.
 */

class FlickemonUI {
    constructor(engine) {
        this.engine = engine;
        this.config = window.FlickemonConfig;

        this.widgetCard = null;
        this.activeModal = null;
        this.popoverOpen = false;
    }

    renderWidget() {
        const card = document.createElement('div');
        card.className = 'flickemon-card flickemon-widget-card';

        this.engine.onStateChange((state) => {
            this.updateWidgetView(card, state, this.engine.wildOpponent);
        });

        this.engine.onWildChange((wild) => {
            this.updateWidgetView(card, this.engine.getGameState(), wild);
        });

        this.engine.onEvolution((evo) => {
            this.showEvolutionOverlay(evo);
        });

        this.widgetCard = card;
        return card;
    }

    updateWidgetView(card, state, wild) {
        if (!state.hasStarted) {
            // Not started view
            card.innerHTML = `
                <div class="flickemon-header start-header">
                    <div class="header-left">
                        <span class="header-icon">🎮</span>
                        <span class="header-title">Flickémon</span>
                    </div>
                    <button class="start-game-badge-btn">Start Game ✨</button>
                </div>
            `;
            card.querySelector('.start-game-badge-btn').addEventListener('click', () => {
                this.openStarterModal();
            });
            return;
        }

        const active = this.engine.getActivePokemon();
        const activeSpecies = active ? this.engine.getSpeciesForPokemon(active) : null;
        if (!active || !activeSpecies) return;

        const expProg = this.engine.getExpProgress(active);

        card.innerHTML = `
            <div class="flickemon-header">
                <div class="header-left">
                    <span class="header-icon">🎮</span>
                    <span class="header-title">Flickémon</span>
                </div>
                <div class="header-actions">
                    <button class="icon-btn menu-trigger-btn" title="Options">⋮</button>
                    <button class="icon-btn widget-collapse-btn" title="Collapse">▼</button>
                </div>
            </div>
            <div class="widget-body">
                <div class="hud-columns">
                    <!-- Left: Active Partner -->
                    <div class="hud-col partner-col">
                        <div class="partner-sprite-box">
                            <img src="${this.config.getSpriteUrl(activeSpecies.id)}" alt="${activeSpecies.name}" class="sprite-img"/>
                        </div>
                        <div class="partner-info">
                            <div class="name-line">
                                <strong class="pk-name">${activeSpecies.name}</strong>
                                <span class="pk-lvl">Lv.${active.level}</span>
                            </div>
                            <div class="exp-bar-track">
                                <div class="exp-bar-fill" style="width: ${expProg.percent}%;"></div>
                            </div>
                            <div class="exp-text">${expProg.current} / ${expProg.needed} EXP</div>
                        </div>
                    </div>

                    <!-- Right: Wild Opponent Battle -->
                    <div class="hud-col battle-col">
                        ${wild ? `
                            <div class="battle-sprite-box">
                                <img src="${this.config.getSpriteUrl(wild.wildSpecies.id)}" alt="${wild.wildSpecies.name}" class="sprite-img ${wild.status}"/>
                            </div>
                            <div class="battle-info">
                                <div class="name-line">
                                    <span class="wild-tag">VS</span>
                                    <strong class="pk-name">${wild.wildSpecies.name}</strong>
                                    <span class="pk-lvl">Lv.${wild.wildLevel}</span>
                                </div>
                                <div class="hp-bar-track">
                                    <div class="hp-bar-fill" style="width: ${Math.round((wild.currentHp / wild.maxHp) * 100)}%;"></div>
                                </div>
                                <div class="hp-text">HP ${wild.currentHp} / ${wild.maxHp}</div>
                                <div class="status-badge ${wild.status}">${wild.status === 'captured' ? 'Captured! 🎉' : wild.status === 'escaped' ? 'Escaped! 💨' : 'Fighting... ⚔️'}</div>
                            </div>
                        ` : '<div class="searching-text">Searching for wild Pokémon...</div>'}
                    </div>
                </div>
            </div>

            <!-- Options Popover Menu -->
            <div class="options-popover-menu" style="display: none;">
                <div class="popover-item game-hub-item"><span>🎮</span> Game Hub</div>
                <div class="popover-item settings-item"><span>⚙️</span> Settings</div>
            </div>
        `;

        const menuBtn = card.querySelector('.menu-trigger-btn');
        const popover = card.querySelector('.options-popover-menu');
        const collapseBtn = card.querySelector('.widget-collapse-btn');
        const widgetBody = card.querySelector('.widget-body');

        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.popoverOpen = !this.popoverOpen;
            popover.style.display = this.popoverOpen ? 'block' : 'none';
        });

        document.addEventListener('click', () => {
            this.popoverOpen = false;
            if (popover) popover.style.display = 'none';
        });

        card.querySelector('.game-hub-item').addEventListener('click', () => {
            this.openGameHub();
        });

        card.querySelector('.settings-item').addEventListener('click', () => {
            this.openSettingsModal();
        });

        let isCollapsed = false;
        collapseBtn.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            widgetBody.style.display = isCollapsed ? 'none' : 'block';
            collapseBtn.textContent = isCollapsed ? '▲' : '▼';
        });
    }

    // ────────────────────────── Starter Selection Modal ──────────────────────────

    openStarterModal() {
        const modal = this.createModalOverlay('Select Your Starter Pokémon');
        const options = this.engine.getStarterOptions();

        let activeTab = 1;
        const genTabs = [
            { gen: 1, label: 'Kanto (Gen 1)' },
            { gen: 2, label: 'Johto (Gen 2)' },
            { gen: 3, label: 'Hoenn (Gen 3)' },
            { gen: 4, label: 'Sinnoh (Gen 4)' },
            { gen: 5, label: 'Unova (Gen 5)' },
            { gen: 6, label: 'Kalos (Gen 6)' },
            { gen: 7, label: 'Alola (Gen 7)' },
        ];

        modal.body.innerHTML = `
            <div class="starter-modal-content">
                <div class="gen-tabs">
                    ${genTabs.map(t => `<button class="gen-tab-btn ${t.gen === 1 ? 'active' : ''}" data-gen="${t.gen}">${t.label}</button>`).join('')}
                </div>
                <div class="starters-grid"></div>
            </div>
        `;

        const renderGrid = (gen) => {
            const grid = modal.body.querySelector('.starters-grid');
            const starters = options.filter(s => s.generation === gen);
            grid.innerHTML = starters.map(s => `
                <div class="starter-card" data-id="${s.id}">
                    <img src="${this.config.getSpriteUrl(s.id)}" alt="${s.name}"/>
                    <h4>${s.name}</h4>
                    <div class="types-row">
                        ${s.types.map(t => `<span class="type-pill ${t}">${t}</span>`).join('')}
                    </div>
                    <button class="choose-starter-btn">Choose ${s.name}</button>
                </div>
            `).join('');

            grid.querySelectorAll('.starter-card').forEach(card => {
                card.querySelector('.choose-starter-btn').addEventListener('click', async () => {
                    const speciesId = parseInt(card.getAttribute('data-id'), 10);
                    await this.engine.chooseStarter(speciesId);
                    this.closeModal(modal);
                });
            });
        };

        renderGrid(1);

        modal.body.querySelectorAll('.gen-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.body.querySelectorAll('.gen-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderGrid(parseInt(btn.getAttribute('data-gen'), 10));
            });
        });
    }

    // ────────────────────────── Game Hub Modal ──────────────────────────

    openGameHub() {
        const modal = this.createModalOverlay('Flickémon Game Hub 🎮');
        const active = this.engine.getActivePokemon();
        const activeSpecies = active ? this.engine.getSpeciesForPokemon(active) : null;
        const party = this.engine.getParty();
        const pokedex = this.engine.getPokedex();

        modal.body.innerHTML = `
            <div class="hub-tabs-row">
                <button class="hub-tab-btn active" data-tab="partner">My Partner</button>
                <button class="hub-tab-btn" data-tab="party">Party (${party.length})</button>
                <button class="hub-tab-btn" data-tab="pokedex">Pokédex (${this.engine.getCaughtCount()}/${this.config.POKEMON_REGISTRY.length})</button>
                <button class="hub-tab-btn" data-tab="stats">Stats</button>
            </div>
            <div class="hub-tab-content"></div>
        `;

        const content = modal.body.querySelector('.hub-tab-content');

        const renderTab = (tab) => {
            if (tab === 'partner' && active && activeSpecies) {
                const expProg = this.engine.getExpProgress(active);
                content.innerHTML = `
                    <div class="partner-tab-view">
                        <img src="${this.config.getSpriteUrl(activeSpecies.id)}" alt="${activeSpecies.name}" class="big-partner-sprite"/>
                        <h2>${activeSpecies.name}</h2>
                        <div class="types-row">${activeSpecies.types.map(t => `<span class="type-pill ${t}">${t}</span>`).join('')}</div>
                        <p class="lvl-badge">Level ${active.level}</p>
                        <div class="stat-bars">
                            <div class="stat-row"><span>HP</span> <strong>${this.config.calculateRealMaxHp(activeSpecies.baseStats.hp, active.level)}</strong></div>
                            <div class="stat-row"><span>Attack</span> <strong>${activeSpecies.baseStats.attack}</strong></div>
                            <div class="stat-row"><span>Defense</span> <strong>${activeSpecies.baseStats.defense}</strong></div>
                            <div class="stat-row"><span>Speed</span> <strong>${activeSpecies.baseStats.speed}</strong></div>
                        </div>
                        <div class="exp-section">
                            <div class="exp-bar-track"><div class="exp-bar-fill" style="width: ${expProg.percent}%;"></div></div>
                            <small>${expProg.current} / ${expProg.needed} EXP to Next Level</small>
                        </div>
                    </div>
                `;
            } else if (tab === 'party') {
                content.innerHTML = `
                    <div class="party-grid">
                        ${party.map(pk => {
                            const sp = this.engine.getSpeciesForPokemon(pk);
                            if (!sp) return '';
                            const isActive = pk.instanceId === active.instanceId;
                            return `
                                <div class="party-card ${isActive ? 'active-pk' : ''}" data-id="${pk.instanceId}">
                                    <img src="${this.config.getSpriteUrl(sp.id)}" alt="${sp.name}"/>
                                    <h4>${sp.name}</h4>
                                    <p>Lv.${pk.level}</p>
                                    ${isActive ? '<span class="active-badge">Active</span>' : `<button class="switch-pk-btn">Switch</button>`}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
                content.querySelectorAll('.switch-pk-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.target.closest('.party-card').getAttribute('data-id');
                        await this.engine.switchActivePokemon(id);
                        renderTab('party');
                    });
                });
            } else if (tab === 'pokedex') {
                content.innerHTML = `
                    <div class="pokedex-grid">
                        ${this.config.POKEMON_REGISTRY.map(sp => {
                            const entry = pokedex.find(p => p.speciesId === sp.id);
                            const caught = entry && entry.caught;
                            const seen = entry && entry.seen;
                            return `
                                <div class="dex-card ${caught ? 'caught' : seen ? 'seen' : 'unseen'}">
                                    <span class="dex-num">#${String(sp.id).padStart(3, '0')}</span>
                                    <img src="${seen ? this.config.getSpriteUrl(sp.id) : ''}" alt="${sp.name}" class="${!caught ? 'silhouette' : ''}"/>
                                    <p>${seen ? sp.name : '???'}</p>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else if (tab === 'stats') {
                content.innerHTML = `
                    <div class="stats-view">
                        <div class="stat-card-box">
                            <h3>📊 Study & Battle Statistics</h3>
                            <p><strong>Total Study Time:</strong> ${Math.round(this.engine.getGameState().totalMinutesWatched)} minutes</p>
                            <p><strong>Party Size:</strong> ${party.length} Pokémon</p>
                            <p><strong>Pokédex Caught:</strong> ${this.engine.getCaughtCount()} / ${this.config.POKEMON_REGISTRY.length}</p>
                        </div>
                    </div>
                `;
            }
        };

        renderTab('partner');

        modal.body.querySelectorAll('.hub-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.body.querySelectorAll('.hub-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderTab(btn.getAttribute('data-tab'));
            });
        });
    }

    // ────────────────────────── Settings Modal ──────────────────────────

    openSettingsModal() {
        const modal = this.createModalOverlay('Flickémon Settings ⚙️');

        modal.body.innerHTML = `
            <div class="settings-modal-view">
                <div class="settings-section">
                    <h3>⚙️ General Options</h3>
                    <button class="reset-progress-btn danger-btn">Reset My Game Progress 🔄</button>
                    <p class="sub-text">Restart starter selection and reset party to 0</p>
                </div>
                <hr/>
                <div class="settings-section admin-section">
                    <h3>🔒 Admin Portal</h3>
                    <div class="admin-passcode-box">
                        <input type="password" class="admin-passcode-input" placeholder="Enter Admin Passcode"/>
                        <button class="unlock-admin-btn">Unlock Admin</button>
                    </div>
                    <div class="admin-unlocked-panel" style="display: none;">
                        <p class="admin-success">✅ Admin Access Granted (Passcode 9285)</p>
                        <p class="sub-text">Student Player Monitoring Portal active in Firestore cloud backend.</p>
                    </div>
                </div>
            </div>
        `;

        modal.body.querySelector('.reset-progress-btn').addEventListener('click', async () => {
            if (confirm('Are you sure you want to reset your Flickémon progress? This will reset your starter, party, and Pokédex.')) {
                await this.engine.resetGameState();
                this.closeModal(modal);
            }
        });

        const passcodeBtn = modal.body.querySelector('.unlock-admin-btn');
        const passcodeInput = modal.body.querySelector('.admin-passcode-input');
        const adminPanel = modal.body.querySelector('.admin-unlocked-panel');

        passcodeBtn.addEventListener('click', () => {
            if (passcodeInput.value.trim() === '9285') {
                adminPanel.style.display = 'block';
            } else {
                alert('Invalid Admin Passcode!');
            }
        });
    }

    // ────────────────────────── Evolution Overlay ──────────────────────────

    showEvolutionOverlay(evo) {
        const overlay = document.createElement('div');
        overlay.className = 'evolution-overlay-screen';
        overlay.innerHTML = `
            <div class="evo-box">
                <h2>✨ What? ${evo.from.name} is evolving! ✨</h2>
                <div class="evo-sprites">
                    <img src="${this.config.getSpriteUrl(evo.from.id)}" class="old-sprite"/>
                    <span class="arrow">➡️</span>
                    <img src="${this.config.getSpriteUrl(evo.to.id)}" class="new-sprite"/>
                </div>
                <h3>Congratulations! Your ${evo.from.name} evolved into ${evo.to.name}! 🎉</h3>
            </div>
        `;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), 5000);
    }

    createModalOverlay(title) {
        const overlay = document.createElement('div');
        overlay.className = 'flickemon-modal-overlay';
        overlay.innerHTML = `
            <div class="flickemon-modal-card">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close-btn">✕</button>
                </div>
                <div class="modal-body"></div>
            </div>
        `;
        overlay.querySelector('.modal-close-btn').addEventListener('click', () => this.closeModal(overlay));
        document.body.appendChild(overlay);
        return { overlay, body: overlay.querySelector('.modal-body') };
    }

    closeModal(modal) {
        if (modal.overlay) modal.overlay.remove();
        else if (modal.remove) modal.remove();
    }
}

window.FlickemonUI = FlickemonUI;
