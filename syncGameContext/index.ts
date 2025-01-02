import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  calculateEnergyLimit,
  calculatePointsPerClick,
  calculateRestoredEnergy,
} from '../_rules/rule.ts';
import { convertToGameContext } from '../_dto/game.ts';

export default async (req: Request) => {
  const headers = req.headers;
  const authorization = headers.get('Authorization');
  if (!authorization) {
    return new Response('Authorization header required', {
      headers: {'Content-Type': 'application/json'},
      status: 401,
    });
  }

  // setup shaple client
  const client = createClient(
    Deno.env.get('SHAPLE_URL') ?? '',
    Deno.env.get('SHAPLE_SERVICE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const jwt = authorization.split(' ')[1];
  const {
    data: { user },
  } = await client.auth.getUser(jwt);

  if (!user) {
    console.error('User not found in getGameContext');
    return new Response('Invalid auth user', {
      headers: {'Content-Type': 'application/json'},
      status: 401,
    });
  }

  const { points, currentEnergy, timestamp } = await req.json();
  if (
    typeof points !== 'number' ||
    typeof currentEnergy !== 'number' ||
    points < 0 ||
    currentEnergy < 0
  ) {
  }

  const { data: gameProfile, error } = await client
    .schema('clicker')
    .from('game_profile')
    .select()
    .eq('owner', user.id)
    .single();

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: {'Content-Type': 'application/json'},
      status: 500,
    });
  }

  if (!gameProfile) {
    console.error('Game profile not found');
    return new Response(JSON.stringify({ error: 'Game profile not found' }), {
      headers: {'Content-Type': 'application/json'},
      status: 404,
    });
  }

  if (timestamp < gameProfile.last_point_updated_at) {
    console.error('timestamp is older than last update');
    return new Response(
      JSON.stringify({ error: 'Invalid timestamp: old timestamp' }),
      {
        headers: {'Content-Type': 'application/json'},
        status: 412,
      },
    );
  }

  const maxEnergyLimit = calculateEnergyLimit(gameProfile.energy_limit_level);
  // Calculate restored energy
  const restoredEnergy = calculateRestoredEnergy(
    new Date(gameProfile.last_energy_updated_at).getTime(),
    timestamp,
  );

  const expectedEnergy = Math.min(
    gameProfile.energy_balance + restoredEnergy,
    maxEnergyLimit,
  );

  if (currentEnergy > expectedEnergy * 1.2) {
    // 20% buffer for network latency
    console.error('Invalid energy calculation');
    return new Response(
      JSON.stringify({
        error: `Invalid energy balance: ${currentEnergy} / expected (${expectedEnergy}`,
      }),
      {
        headers: {'Content-Type': 'application/json'},
        status: 412,
      },
    );
  }

  const pointsPerClick = calculatePointsPerClick(gameProfile.multitap_level);

  // Calculate maximum possible points gained
  const maxPossibleClicks = Math.floor(expectedEnergy / pointsPerClick);
  const maxPossiblePoints = maxPossibleClicks * pointsPerClick * 1.2; // 20% buffer for network latency

  const unsyncedPoints = points - gameProfile.point_balance;
  // Validate the unsynchronized points
  if (unsyncedPoints > maxPossiblePoints) {
    return new Response(
      JSON.stringify({
        error: `Invalid points calculation: unsynced points=${unsyncedPoints}, max possible points=${maxPossiblePoints}`,
      }),
      {
        headers: {'Content-Type': 'application/json'},
        status: 412,
      },
    );
  }

  // Update user data with optimistic locking
  const updatedAt = new Date(timestamp);
  const { data: updatedGameProfile, error: updateError } = await client
    .schema('clicker')
    .from('game_profile')
    .update({
      point_balance: points,
      total_earned_points: gameProfile.total_earned_points + unsyncedPoints,
      energy_balance: currentEnergy,
      last_point_updated_at: updatedAt,
      last_energy_updated_at: updatedAt,
    })
    .eq('id', gameProfile.id)
    .single().select(`
      *,
      user_booster (
        *,
        booster (*)
      ),
      user_daily_booster (
        *,
        daily_booster (*)
      )
    `);

  if (updateError) {
    console.error(updateError);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: {'Content-Type': 'application/json'},
      status: 500,
    });
  }

  const userBoosters = gameProfile.user_booster ?? ([] as any[]);
  const userDailyBoosters = gameProfile.user_daily_booster ?? ([] as any[]);

  return new Response(
    JSON.stringify(
      convertToGameContext(updatedGameProfile, userBoosters, userDailyBoosters),
    ),
    {
      headers: {'Content-Type': 'application/json'},
      status: 200,
    },
  );
};
