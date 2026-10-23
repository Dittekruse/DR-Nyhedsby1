
import { supabase } from './supabase.js';

let pendingFlags = 0;
let saving = false;

export async function refreshFlags() {
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error('Du skal være logget ind for at hente flag.');

  const { data, error } = await supabase
    .from('player_scores')
    .select('total_flags')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;

  const totalFlags = Number(data?.total_flags ?? 0);

  window.dispatchEvent(new CustomEvent('dr-flags-updated', {
    detail: { totalFlags }
  }));

  return totalFlags;
}

async function saveFlags() {
  if (saving || pendingFlags <= 0) return;

  saving = true;
  const earned = pendingFlags;
  pendingFlags = 0;

  try {
    const { data: { user }, error: authError } =
      await supabase.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error('Du skal være logget ind for at optjene flag.');

    const { data, error } = await supabase
      .from('player_scores')
      .select('total_flags')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    const totalFlags = Number(data?.total_flags ?? 0) + earned;

    const { error: saveError } = await supabase
      .from('player_scores')
      .upsert({
        user_id: user.id,
        total_flags: totalFlags,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (saveError) throw saveError;

    window.dispatchEvent(new CustomEvent('dr-flags-updated', {
      detail: { totalFlags }
    }));

    console.log(`Gemt ${earned} flag. Samlet antal: ${totalFlags}`);
  } catch (error) {
    console.error('Kunne ikke gemme flag:', error);
    pendingFlags += earned;
  } finally {
    saving = false;

    if (pendingFlags > 0) {
      void saveFlags();
    }
  }
}

window.addEventListener('dr-earn-flags', event => {
  const amount = Number(event.detail?.amount ?? 0);

  if (!Number.isInteger(amount) || amount <= 0) return;

  pendingFlags += amount;
  void saveFlags();
});
