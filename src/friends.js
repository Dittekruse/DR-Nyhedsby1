
import { supabase } from './supabase.js';

const friendsPanel = document.getElementById('friends-panel');
const searchInput = document.getElementById('friend-search');
const searchButton = document.getElementById('friend-search-button');
const searchResults = document.getElementById('friend-search-results');
const requestsList = document.getElementById('friend-requests');
const friendsList = document.getElementById('friends-list');
const message = document.getElementById('friends-message');

let currentUserId = null;

function showMessage(text) {
  message.textContent = text;
}


async function getCurrentUser() {
  const { data, error } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (error || !user) {
    showMessage(
      'Login-sessionen kunne ikke findes. Prøv at logge ud og ind igen.'
    );
    console.error('Fejl ved hentning af login-session:', error);
    return null;
  }

  currentUserId = user.id;
  return user;
}


function createFriendRow(username, buttonText, onClick) {
  const row = document.createElement('div');
  row.className = 'friend';

  const name = document.createElement('strong');
  name.textContent = username;

  const button = document.createElement('button');
  button.textContent = buttonText;
  button.addEventListener('click', onClick);

  row.append(name, button);
  return row;
}

async function searchUsers() {
  const username = searchInput.value.trim();

  searchResults.replaceChildren();

  if (username.length < 3) {
    showMessage('Skriv mindst 3 tegn for at søge.');
    return;
  }

  const user = await getCurrentUser();
  if (!user) return;

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', `%${username}%`)
    .neq('id', currentUserId)
    .limit(10);

  if (error) {
    showMessage('Kunne ikke søge efter brugere. Tjek Supabase-politikkerne.');
    return;
  }

  if (!profiles.length) {
    showMessage('Ingen brugere fundet.');
    return;
  }

  showMessage(`Fandt ${profiles.length} bruger(e).`);

  for (const profile of profiles) {
    const row = createFriendRow(profile.username, 'Tilføj ven', async () => {
      const { error: requestError } = await supabase
        .from('friendships')
        .insert({
          requester_id: currentUserId,
          addressee_id: profile.id,
          status: 'pending'
        });

      if (requestError) {
        showMessage(
          requestError.code === '23505'
            ? 'Du har allerede sendt en anmodning, eller I er allerede venner.'
            : 'Kunne ikke sende anmodningen. Tjek tabellen friendships og dens politikker.'
        );
        return;
      }

      row.remove();
      showMessage(`Venneanmodning sendt til ${profile.username}.`);
      await loadFriends();
    });

    searchResults.appendChild(row);
  }
}

function createLeaderboardSection() {
  let section = document.getElementById('leaderboard-section');

  if (section) return section;

  section = document.createElement('section');
  section.id = 'leaderboard-section';
  section.style.cssText = `
    margin: 16px 0;
    padding: 16px;
    background: #f3f7fb;
    border-radius: 12px;
    color: #173b63;
  `;

  section.innerHTML = `
    <h2 style="margin-top:0">🏆 Leaderboard</h2>
    <div id="global-leaderboard">
      <h3>🌍 Global top 3</h3>
      <p>Henter resultater...</p>
    </div>
    <div id="friends-leaderboard" style="margin-top:18px">
      <h3>👥 Venners top 3</h3>
      <p>Henter resultater...</p>
    </div>
  `;

  friendsPanel.prepend(section);
  return section;
}

async function loadLeaderboard() {
  const section = createLeaderboardSection();
  const globalList = section.querySelector('#global-leaderboard');
  const friendsBoard = section.querySelector('#friends-leaderboard');

globalList.innerHTML = '<h3><img src="./icons/globus.svg" width="24" height="24" style="vertical-align:middle"> Global top 3</h3><p>Henter...</p>';  friendsBoard.innerHTML = '<h3>👥 Venners top 3</h3><p>Henter...</p>';

  const user = await getCurrentUser();
  if (!user) return;

  try {
    // Hent profiler og flagtal.
    const [
      { data: profiles, error: profilesError },
      { data: scores, error: scoresError }
    ] = await Promise.all([
      supabase.from('profiles').select('id, username'),
      supabase.from('player_scores').select('user_id, total_flags')
    ]);

    if (profilesError) throw profilesError;
    if (scoresError) throw scoresError;

    const profileMap = new Map(
      (profiles || []).map(profile => [profile.id, profile])
    );

    const scoreMap = new Map(
      (scores || []).map(score => [
        score.user_id,
        Number(score.total_flags) || 0
      ])
    );

    const rankedPlayers = (profiles || [])
      .map(profile => ({
        id: profile.id,
        username: profile.username || 'Ukendt spiller',
        flags: scoreMap.get(profile.id) || 0
      }))
      .sort((a, b) => b.flags - a.flags);

    function renderTopThree(container, players) {
      const heading = container.querySelector('h3');
      container.replaceChildren(heading);

      const topThree = players.slice(0, 3);

      if (!topThree.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Ingen resultater endnu.';
        container.appendChild(empty);
        return;
      }

      topThree.forEach((player, index) => {
        const row = document.createElement('div');
        row.style.cssText = `
          display:flex;
          justify-content:space-between;
          gap:12px;
          padding:9px 0;
          border-bottom:1px solid #dce4ec;
        `;

        const name = document.createElement('span');
        name.textContent =
          `${['🥇', '🥈', '🥉'][index]} ${player.username}`;

        const score = document.createElement('strong');
score.innerHTML = `<img src="./icons/flag.svg" width="20" height="20" style="vertical-align:middle"> ${player.flags}`;
        row.append(name, score);
        container.appendChild(row);
      });
    }

    renderTopThree(globalList, rankedPlayers);

    // Hent accepterede venskaber.
    const { data: friendships, error: friendsError } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(
        `requester_id.eq.${user.id},addressee_id.eq.${user.id}`
      );

    if (friendsError) throw friendsError;

    const friendIds = new Set([user.id]);

    (friendships || []).forEach(friendship => {
      friendIds.add(
        friendship.requester_id === user.id
          ? friendship.addressee_id
          : friendship.requester_id
      );
    });

    const friendsRanked = rankedPlayers.filter(player =>
      friendIds.has(player.id)
    );

    renderTopThree(friendsBoard, friendsRanked);

  } catch (error) {
    console.error('Kunne ikke hente leaderboard:', error);

    globalList.innerHTML =
      '<h3>🌍 Global top 3</h3><p>Kunne ikke hente resultater.</p>';

    friendsBoard.innerHTML =
      '<h3>👥 Venners top 3</h3><p>Kunne ikke hente resultater.</p>';

    showMessage(
      'Leaderboardet kunne ikke indlæses. Tjek fejlene i Console.'
    );
  }
}

async function loadFriends() {
  const user = await getCurrentUser();
  if (!user) return;

  requestsList.replaceChildren();
  friendsList.replaceChildren();

  const { data: incoming, error: incomingError } = await supabase
    .from('friendships')
    .select('id, requester_id, profiles!friendships_requester_id_fkey(username)')
    .eq('addressee_id', currentUserId)
    .eq('status', 'pending');

  if (incomingError) {
    showMessage('Kunne ikke hente venneanmodninger.');
    return;
  }

  for (const request of incoming || []) {
    const username = request.profiles?.username || 'Ukendt bruger';

    requestsList.appendChild(
      createFriendRow(username, 'Accepter', async () => {
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', request.id)
          .eq('addressee_id', currentUserId);

        if (error) {
          showMessage('Kunne ikke acceptere anmodningen. Tjek Supabase-politikkerne.');
          return;
        }

        showMessage(`Du er nu venner med ${username}.`);
        await loadFriends();
      })
    );
  }

  const { data: sent, error: sentError } = await supabase
    .from('friendships')
    .select('id, addressee_id, profiles!friendships_addressee_id_fkey(username)')
    .eq('requester_id', currentUserId)
    .eq('status', 'pending');

  if (sentError) {
    showMessage('Kunne ikke hente sendte anmodninger.');
    return;
  }

  const { data: accepted, error: acceptedError } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

  if (acceptedError) {
    showMessage('Kunne ikke hente vennelisten. Tjek Supabase-politikkerne.');
    return;
  }

  for (const friendship of accepted || []) {
    const otherId = friendship.requester_id === currentUserId
      ? friendship.addressee_id
      : friendship.requester_id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', otherId)
      .maybeSingle();

    if (!profile) continue;
friendsList.appendChild(
  createFriendRow(profile.username, 'Se by', () => {
    const cityUrl = new URL('./by.html', window.location.href);
    cityUrl.searchParams.set('user', otherId);

    window.location.assign(cityUrl.href);
  })
);

  }

  if (!requestsList.children.length) {
    requestsList.textContent = 'Ingen nye venneanmodninger.';
  }

  if (!friendsList.children.length) {
    friendsList.textContent = 'Du har ikke tilføjet nogen venner endnu.';
  }

  if (sent?.length) {
    showMessage(`Du har ${sent.length} ventende venneanmodning(er).`);
  }
}

searchButton.addEventListener('click', searchUsers);

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') searchUsers();
});


document.getElementById('open-friends-button').addEventListener('click', async () => {
  document.getElementById('home').classList.add('hidden');
  friendsPanel.classList.remove('hidden');
  showMessage('');

  await Promise.all([
    loadFriends(),
    loadLeaderboard()
  ]);
});

document.getElementById('back-home-button').addEventListener('click', () => {
  friendsPanel.classList.add('hidden');
  document.getElementById('home').classList.remove('hidden');
});

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    currentUserId = session.user.id;
  }
});
