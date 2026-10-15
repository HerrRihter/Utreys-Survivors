import { abilityDefinitions } from '../../data/characters/abilities.js';
export let GameUI;
('use strict');
GameUI = {
  create(sessionContext) {
    function animateMenu(now) {
      const phase = sessionContext.Math.floor(now / 190) % 8;
      if (phase === sessionContext.menuPortraitPhase) return;
      sessionContext.menuPortraitPhase = phase;
      sessionContext.document
        .querySelectorAll('[data-portrait]')
        .forEach((c) => sessionContext.fitPortrait(c, c.dataset.portrait, phase));
    }
    function show(id, on) {
      const el = sessionContext.$(id);
      if (el) el.classList.toggle('hidden', !on);
    }
    function toast(text) {
      const el = sessionContext.$('toast');
      if (el) {
        el.textContent = text;
        if (el.style) el.style.opacity = '1';
        sessionContext.toastLeft = 3;
      }
    }
    function updateRecord() {
      const w = sessionContext.$('wallet');
      if (w) w.textContent = 'КОДЫ: ' + sessionContext.Progression.data.helmets;
      const r = sessionContext.$('record');
      if (r)
        r.textContent = sessionContext.best.time
          ? `ЛУЧШЕЕ ВРЕМЯ: ${sessionContext.clock(sessionContext.best.time)}`
          : 'Лучшее время появится после первого забега.';
      const defs = sessionContext.Progression.achievements;
      const data = sessionContext.Progression.data;
      const unclaimed = defs
        ? defs.filter(
            (a) =>
              a.getProgress(data, sessionContext.best) >= a.target &&
              !sessionContext.Progression.isClaimed(a.id),
          ).length
        : 0;
      const btn = sessionContext.$('achievementsOpen');
      if (btn) btn.textContent = unclaimed > 0 ? `ДОСТИЖЕНИЯ (${unclaimed}!)` : 'ДОСТИЖЕНИЯ';
    }
    function updateRunHeroStats() {
      const hero = sessionContext.Villagers.defs[sessionContext.pendingRunHero];
      sessionContext.$('runHeroStats').textContent =
        (hero.desc || `Здоровье: ${hero.hp} · Скорость: ${hero.speed}`) +
        '\n' +
        abilityDefinitions[sessionContext.pendingRunHero]
          .map(
            (a, i) => `${i ? 'E' : 'Q'} · ${a.name}: ${a.description} Перезарядка ${a.cooldown} с.`,
          )
          .join('\n');
    }
    function renderRunHeroes() {
      const list = sessionContext.$('runHeroes'),
        heroes = Object.keys(sessionContext.Villagers.defs).filter((id) =>
          sessionContext.Progression.owned(id),
        );
      if (!heroes.length) throw new Error('Нет доступных героев для нового забега');
      list.replaceChildren();
      sessionContext.pendingRunHero = heroes.includes(sessionContext.selected)
        ? sessionContext.selected
        : heroes[0];
      for (const id of heroes) {
        const hero = sessionContext.Villagers.defs[id],
          button = sessionContext.document.createElement('button'),
          portrait = sessionContext.document.createElement('canvas'),
          copy = sessionContext.document.createElement('span'),
          name = sessionContext.document.createElement('strong'),
          weapon = sessionContext.document.createElement('small');
        button.type = 'button';
        button.className = `run-hero${id === sessionContext.pendingRunHero ? ' selected' : ''}`;
        button.dataset.hero = id;
        portrait.width = 64;
        portrait.height = 80;
        portrait.dataset.portrait = id;
        copy.className = 'run-hero-copy';
        name.textContent = hero.name;
        weapon.textContent = hero.weapon;
        copy.append(name, weapon);
        button.append(portrait, copy);
        button.onclick = () => {
          sessionContext.pendingRunHero = id;
          list
            .querySelectorAll('.run-hero')
            .forEach((card) => card.classList.toggle('selected', card.dataset.hero === id));
          updateRunHeroStats();
        };
        list.append(button);
      }
      updateRunHeroStats();
      sessionContext.menuPortraitPhase = -1;
      animateMenu(sessionContext.performance.now());
    }
    function openRunHeroSelect() {
      renderRunHeroes();
      show('shop', false);
      show('achievements', false);
      show('menu', false);
      show('runHeroSelect', true);
    }
    function renderShop() {
      updateRecord();
      const root = sessionContext.$('shopHeroes');
      root.replaceChildren();
      for (const [id, hero] of Object.entries(sessionContext.Villagers.defs)) {
        const card = sessionContext.document.createElement('div');
        card.className = 'shopcard';
        const art = sessionContext.document.createElement('canvas');
        art.width = 96;
        art.height = 96;
        art.dataset.portrait = id;
        sessionContext.fitPortrait(art, id);
        card.append(art);
        const title = sessionContext.document.createElement('h3');
        title.textContent = hero.name;
        card.append(title);
        const desc = sessionContext.document.createElement('p');
        desc.textContent = hero.desc;
        card.append(desc);
        const info = sessionContext.document.createElement('small');
        info.textContent = hero.hp + ' HP · скорость ' + hero.speed;
        card.append(info);
        const button = sessionContext.document.createElement('button'),
          owned = sessionContext.Progression.owned(id);
        button.className = 'small';
        button.textContent = owned
          ? 'Доступен для забега'
          : 'Купить · ' + sessionContext.Progression.prices[id] + ' кодов';
        button.disabled =
          owned || sessionContext.Progression.data.helmets < sessionContext.Progression.prices[id];
        button.onclick = () => {
          if (!sessionContext.Progression.owned(id) && sessionContext.Progression.buyHero(id))
            renderShop();
        };
        card.append(button);
        root.append(card);
      }
      sessionContext.$('shopUpgrades').replaceChildren();
      let shopGroup = '';
      for (const [id, u] of Object.entries(sessionContext.Progression.upgrades)) {
        const group = u.hero ? 'Личные усиления' : 'Общие усиления';
        if (group !== shopGroup) {
          const title = sessionContext.document.createElement('h4');
          title.textContent = group;
          sessionContext.$('shopUpgrades').append(title);
          shopGroup = group;
        }
        const level = sessionContext.Progression.data.levels[id],
          b = sessionContext.document.createElement('button');
        b.className = 'small';
        b.textContent =
          (u.hero ? sessionContext.Villagers.defs[u.hero].name + ' · ' : '') +
          u.name +
          ' ' +
          level +
          '/' +
          u.max +
          ' · ' +
          u.desc +
          ' · ' +
          (level >= u.max ? 'Максимум' : sessionContext.Progression.cost(id) + ' кодов');
        b.disabled =
          (u.hero && !sessionContext.Progression.owned(u.hero)) ||
          level >= u.max ||
          sessionContext.Progression.data.helmets < sessionContext.Progression.cost(id);
        if (u.hero && !sessionContext.Progression.owned(u.hero))
          b.textContent += ' · Сначала открой героя';
        b.onclick = () => {
          if (sessionContext.Progression.buyUpgrade(id)) renderShop();
        };
        sessionContext.$('shopUpgrades').append(b);
      }
      sessionContext.$('shopWallet').textContent =
        'У вас ' +
        sessionContext.Progression.data.helmets +
        ' кодов · до следующей награды: ' +
        (10 - (sessionContext.Progression.data.kills % 10)) +
        ' побед' +
        (sessionContext.Progression.persistent
          ? ''
          : ' · Не удалось сохранить прогресс. Не закрывай игру.');
    }
    function closeShop() {
      show('shop', false);
      show('menu', true);
    }
    function renderAchievements() {
      updateRecord();
      const list = sessionContext.$('achievementsList'),
        summary = sessionContext.$('achievementsSummary');
      if (!list || !summary) return;
      list.replaceChildren();
      summary.replaceChildren();
      const defs = sessionContext.Progression.achievements;
      const data = sessionContext.Progression.data;
      let completedCount = 0,
        claimedCount = 0;
      const cardsData = defs.map((ach) => {
        const progress = ach.getProgress(data, sessionContext.best);
        const isDone = progress >= ach.target;
        const isClaimed = sessionContext.Progression.isClaimed(ach.id);
        if (isDone) completedCount++;
        if (isClaimed) claimedCount++;
        return { ach, progress, isDone, isClaimed };
      });
      cardsData.sort((a, b) => {
        const scoreA = a.isClaimed ? -1 : a.isDone ? 2 : 1;
        const scoreB = b.isClaimed ? -1 : b.isDone ? 2 : 1;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return b.progress / b.ach.target - a.progress / a.ach.target;
      });
      const total = defs.length;
      const pct = total ? Math.round((completedCount / total) * 100) : 0;
      const sumHead = sessionContext.document.createElement('div');
      sumHead.className = 'achievements-summary-header';
      const sumDoneSpan = sessionContext.document.createElement('span');
      sumDoneSpan.textContent = `Выполнено: ${completedCount} из ${total} (${pct}%)`;
      const sumClaimSpan = sessionContext.document.createElement('span');
      sumClaimSpan.textContent = `Получено наград: ${claimedCount} / ${total}`;
      sumHead.append(sumDoneSpan, sumClaimSpan);
      const bar = sessionContext.document.createElement('div');
      bar.className = 'achievements-bar';
      const barFill = sessionContext.document.createElement('i');
      barFill.style.width = `${pct}%`;
      bar.append(barFill);
      summary.append(sumHead, bar);
      for (const { ach, progress, isDone, isClaimed } of cardsData) {
        const card = sessionContext.document.createElement('div');
        card.className = `achievement-card${isDone ? ' completed' : ''}${isClaimed ? ' claimed' : ''}`;
        const head = sessionContext.document.createElement('div');
        head.className = 'achievement-head';
        const icon = sessionContext.document.createElement('div');
        icon.className = 'achievement-icon';
        if (
          ach.icon &&
          typeof ach.icon === 'string' &&
          (ach.icon.includes('/') || ach.icon.endsWith('.png'))
        ) {
          const img = sessionContext.document.createElement('img');
          img.src = ach.icon;
          img.alt = ach.title;
          img.className = 'achievement-icon-img';
          img.loading = 'lazy';
          img.onerror = () => {
            img.style.display = 'none';
            icon.textContent = '🏆';
          };
          icon.append(img);
        } else {
          icon.textContent = ach.icon || '🏆';
        }
        const info = sessionContext.document.createElement('div');
        info.className = 'achievement-info';
        const title = sessionContext.document.createElement('h3');
        title.textContent = ach.title;
        const desc = sessionContext.document.createElement('p');
        desc.textContent = ach.desc;
        info.append(title, desc);
        head.append(icon, info);
        const prog = sessionContext.document.createElement('div');
        prog.className = 'achievement-progress';
        const progInfo = sessionContext.document.createElement('div');
        progInfo.className = 'achievement-progress-info';
        const curFormatted = ach.format === 'time' ? sessionContext.clock(progress) : progress;
        const targetFormatted =
          ach.format === 'time'
            ? sessionContext.clock(ach.target)
            : `${ach.target}${ach.unit ? ' ' + ach.unit : ''}`;
        const itemPct = Math.min(100, Math.floor((progress / ach.target) * 100));
        const valSpan = sessionContext.document.createElement('span');
        valSpan.textContent = `${curFormatted} / ${targetFormatted}`;
        const pctSpan = sessionContext.document.createElement('span');
        pctSpan.textContent = `${itemPct}%`;
        progInfo.append(valSpan, pctSpan);
        const itemBar = sessionContext.document.createElement('div');
        itemBar.className = 'achievements-bar';
        const itemBarFill = sessionContext.document.createElement('i');
        itemBarFill.style.width = `${itemPct}%`;
        itemBar.append(itemBarFill);
        prog.append(progInfo, itemBar);
        const foot = sessionContext.document.createElement('div');
        foot.className = 'achievement-foot';
        const isHelmet = !ach.rewardType || ach.rewardType === 'helmets';
        const reward = sessionContext.document.createElement('span');
        reward.className = 'achievement-reward';
        if (isHelmet) {
          reward.textContent = `+${ach.reward}`;
          const hIcon = sessionContext.document.createElement('i');
          hIcon.className = 'ach-helmet-icon';
          if (hIcon.setAttribute) hIcon.setAttribute('aria-hidden', 'true');
          reward.append(hIcon);
        } else {
          reward.textContent = `+${ach.reward} ${ach.rewardType}`;
        }
        foot.append(reward);
        if (isClaimed) {
          const badge = sessionContext.document.createElement('span');
          badge.className = 'ach-badge claimed';
          badge.textContent = '✓ ПОЛУЧЕНО';
          foot.append(badge);
        } else if (isDone) {
          const btn = sessionContext.document.createElement('button');
          btn.className = 'primary ach-claim';
          const btnText = sessionContext.document.createElement('span');
          btnText.textContent = `ЗАБРАТЬ +${ach.reward}`;
          btn.append(btnText);
          if (isHelmet) {
            const hIcon = sessionContext.document.createElement('i');
            hIcon.className = 'ach-helmet-icon';
            if (hIcon.setAttribute) hIcon.setAttribute('aria-hidden', 'true');
            btn.append(hIcon);
          }
          btn.onclick = () => {
            if (sessionContext.Progression.claimAchievement(ach.id, sessionContext.best)) {
              sessionContext.soundEffect?.('pickup');
              renderAchievements();
            }
          };
          foot.append(btn);
        } else {
          const badge = sessionContext.document.createElement('span');
          badge.className = 'ach-badge in-progress';
          badge.textContent = 'В ПРОЦЕССЕ';
          foot.append(badge);
        }
        card.append(head, prog, foot);
        list.append(card);
      }
    }
    function openAchievements() {
      renderAchievements();
      show('menu', false);
      show('shop', false);
      show('runHeroSelect', false);
      show('achievements', true);
    }
    function closeAchievements() {
      show('achievements', false);
      show('menu', true);
      updateRecord();
    }
    const gameSettings = { shake: true, hints: true };
    try {
      const saved = JSON.parse(sessionContext.localStorage.getItem('utreys-settings'));
      if (saved && typeof saved === 'object') {
        if (typeof saved.shake === 'boolean') gameSettings.shake = saved.shake;
        if (typeof saved.hints === 'boolean') gameSettings.hints = saved.hints;
      }
    } catch {}
    function saveGameSettings() {
      try {
        sessionContext.localStorage.setItem('utreys-settings', JSON.stringify(gameSettings));
      } catch {}
    }
    function applyHintsDisplay() {
      const showHints = !!gameSettings.hints;
      show(
        'hint',
        showHints &&
          (sessionContext.mode === 'play' ||
            sessionContext.mode === 'pause' ||
            !!sessionContext.state),
      );
      const menuHint = sessionContext.$('menuHint');
      if (menuHint) menuHint.classList.toggle('hidden', !showHints);
      const lvlHint = sessionContext.$('levelupHint');
      if (lvlHint) lvlHint.classList.toggle('hidden', !showHints);
      if (sessionContext.document?.body) {
        sessionContext.document.body.classList.toggle('hide-hints', !showHints);
      }
    }
    function updateGameSettingButtons() {
      const sBtn = sessionContext.$('settingShake');
      if (sBtn) {
        sBtn.textContent = gameSettings.shake ? 'ВКЛ' : 'ВЫКЛ';
        sBtn.style.color = gameSettings.shake ? 'var(--gold)' : '#99a896';
      }
      const hBtn = sessionContext.$('settingHints');
      if (hBtn) {
        hBtn.textContent = gameSettings.hints ? 'ВКЛ' : 'ВЫКЛ';
        hBtn.style.color = gameSettings.hints ? 'var(--gold)' : '#99a896';
      }
      applyHintsDisplay();
    }
    let settingsOrigin = 'menu';
    function openSettings(fromView = 'menu') {
      settingsOrigin = fromView;
      show('menu', false);
      show('paused', false);
      show('shop', false);
      show('achievements', false);
      show('runHeroSelect', false);
      show('settings', true);
      updateGameSettingButtons();
    }
    function closeSettings() {
      show('settings', false);
      show(settingsOrigin || 'menu', true);
      applyHintsDisplay();
    }
    const sBtn = sessionContext.$('settingShake');
    if (sBtn)
      sBtn.onclick = () => {
        gameSettings.shake = !gameSettings.shake;
        saveGameSettings();
        updateGameSettingButtons();
        sessionContext.soundEffect?.('ui');
      };
    const hBtn = sessionContext.$('settingHints');
    if (hBtn)
      hBtn.onclick = () => {
        gameSettings.hints = !gameSettings.hints;
        saveGameSettings();
        updateGameSettingButtons();
        sessionContext.soundEffect?.('ui');
      };
    const sCloseBtn = sessionContext.$('settingsClose');
    if (sCloseBtn) sCloseBtn.onclick = closeSettings;
    const sBackBtn = sessionContext.$('settingsBack');
    if (sBackBtn) sBackBtn.onclick = closeSettings;
    updateGameSettingButtons();
    let elHealth = null,
      elXp = null,
      elLevel = null,
      elTime = null,
      elKills = null,
      elWeapon = null,
      elHelmets = null,
      elBosshealth = null;
    let lastHealthPct = -1,
      lastHp = -1,
      lastMax = -1,
      lastXp = -1,
      lastNeed = -1,
      lastLevel = -1,
      lastTime = -1,
      lastKills = -1,
      lastWeaponKey = '',
      lastHelmets = -1,
      lastEarned = -1,
      lastBossActive = null,
      lastBossHpPct = -1;
    function hud() {
      const nodes = sessionContext.state?.nodes || [];
      const next = nodes
        .filter((n) => n.status === 'guarded')
        .sort(
          (a, b) =>
            Math.hypot(a.x - sessionContext.state.p.x, a.y - sessionContext.state.p.y) -
            Math.hypot(b.x - sessionContext.state.p.x, b.y - sessionContext.state.p.y),
        )[0];
      const progress = sessionContext.$('nodeProgress');
      if (progress)
        progress.textContent =
          `Узлы: ${nodes.filter((n) => n.status !== 'guarded').length}/${nodes.length}` +
          (next
            ? ` · ${next.id} ${['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][(Math.round(Math.atan2(next.y - sessionContext.state.p.y, next.x - sessionContext.state.p.x) / (Math.PI / 4)) + 8) % 8]} ${Math.round(Math.hypot(next.x - sessionContext.state.p.x, next.y - sessionContext.state.p.y))} px`
            : ' · Шлюз ЦРПТ разблокирован');
      sessionContext.abilities.hud();
      if (!sessionContext.state) return;
      const s = sessionContext.state;
      elHealth = sessionContext.$('health');
      elXp = sessionContext.$('xp');
      elLevel = sessionContext.$('levelText');
      elTime = sessionContext.$('time');
      elKills = sessionContext.$('kills');
      elWeapon = sessionContext.$('weapon');
      elHelmets = sessionContext.$('helmets');
      elBosshealth = sessionContext.$('bosshealth');

      const hp = sessionContext.Math.ceil(s.p.hp),
        max = s.p.max,
        healthPct = sessionContext.Math.round((s.p.hp / max) * 1000) / 10;
      if (healthPct !== lastHealthPct && elHealth?.style) {
        lastHealthPct = healthPct;
        elHealth.style.width = `${healthPct}%`;
      }
      if ((hp !== lastHp || max !== lastMax || s.level !== lastLevel) && elLevel) {
        lastHp = hp;
        lastMax = max;
        lastLevel = s.level;
        elLevel.textContent = `УР. ${s.level}  ·  ${sessionContext.Math.ceil(hp)} / ${max} HP`;
      }
      if ((s.xp !== lastXp || s.need !== lastNeed) && elXp?.style) {
        lastXp = s.xp;
        lastNeed = s.need;
        elXp.style.width = `${sessionContext.Math.min(100, (s.xp / s.need) * 100)}%`;
      }
      const sec = sessionContext.Math.floor(s.t);
      if (sec !== lastTime && elTime) {
        lastTime = sec;
        elTime.textContent = sessionContext.clock(s.t);
      }
      if (s.kills !== lastKills && elKills) {
        lastKills = s.kills;
        elKills.textContent = `${s.kills} ПОБЕЖДЕНО`;
      }
      const wKey = `${sessionContext.selected}:${s.map}`;
      if (wKey !== lastWeaponKey && elWeapon) {
        lastWeaponKey = wKey;
        elWeapon.textContent =
          sessionContext.Villagers.defs[sessionContext.selected]?.weapon +
          ' · ' +
          sessionContext.arenaDefinitions[s.map]?.name;
      }
      const hCount = sessionContext.Progression.helmets;
      if ((hCount !== lastHelmets || s.earned !== lastEarned) && elHelmets) {
        lastHelmets = hCount;
        lastEarned = s.earned;
        elHelmets.textContent = 'КОДЫ: ' + hCount + ' (+' + s.earned + ')';
      }
      const boss = s.enemies.find((e) => e.boss);
      const bossActive = !!boss;
      if (bossActive !== lastBossActive) {
        lastBossActive = bossActive;
        show('bossbar', bossActive);
      }
      if (boss) {
        const bossName = sessionContext.$('bossname'),
          name = boss.name || 'ШЛЮЗ ЦРПТ';
        if (bossName && bossName.textContent !== name) bossName.textContent = name;
        const bossPct = sessionContext.Math.round((boss.hp / boss.max) * 1000) / 10;
        if (bossPct !== lastBossHpPct && elBosshealth?.style) {
          lastBossHpPct = bossPct;
          elBosshealth.style.width = `${bossPct}%`;
        }
      }
    }
    return {
      animateMenu,
      show,
      toast,
      updateRecord,
      updateRunHeroStats,
      renderRunHeroes,
      openRunHeroSelect,
      renderShop,
      closeShop,
      renderAchievements,
      openAchievements,
      closeAchievements,
      openSettings,
      closeSettings,
      updateGameSettingButtons,
      gameSettings,
      hud,
    };
  },
};
