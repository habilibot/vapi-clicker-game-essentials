import { createClient } from "https://esm.sh/@shaple/shaple@0.2.2";
import { calculateUpgradeCost } from '../_rules/rule.ts';
import gameConfigs from '../_rules/gameConfigs.json' with { type: 'json' };
import { convertToBoosterWithContext } from '../_dto/booster.ts';

export default async (req: Request) => {
  const headers = req.headers;
  const authorization = headers.get('Authorization');
  if (!authorization) {
    return new Response('Authorization header required', {
      headers: {'Content-Type': 'application/json'},
      status: 401,
    });
  }
  const { id } = await req.json();

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

  if (!user) {
    console.error('User not found in getGameContext');
    return new Response('Invalid auth user', {
      headers: {'Content-Type': 'application/json'},
      status: 401,
    });
  }

  // upsert user booster
  const { data: userBooster, error: upsertUserBoosterError } = await client
    .schema('clicker')
    .from('user_booster')
    .upsert(
      {
        booster_id: id,
        game_profile_id: gameProfile.id,
      },
      {
        onConflict: ['booster_id', 'game_profile_id'],
      },
    )
    .single()
    .select(`*, booster (*)`);

  if (upsertUserBoosterError) {
    console.error(upsertUserBoosterError);
    return new Response('Failed to upsert booster', {
      headers: {'Content-Type': 'application/json'},
      status: 500,
    });
  }

  // upgrade booster
  const requiredPoints = calculateUpgradeCost(
    userBooster.level,
    userBooster.booster.base_price,
    gameConfigs.energy_limit_upgrade_price_multiplier,
  );

  const remainingPoints = gameProfile.points - requiredPoints;
  if (remainingPoints < 0) {
    return new Response(JSON.stringify({ error: 'Not enough points' }), {
      headers: {'Content-Type': 'application/json'},
      status: 400,
    });
  }

  const { error: upgradeError } = await client
    .schema('clicker')
    .rpc('upgrade_booster', {
      user_booster_id: userBooster.id,
      game_profile_id: gameProfile.id,
      points_to_decrease: requiredPoints,
    });

  if (upgradeError) {
    console.error(upgradeError);
    return new Response(JSON.stringify({ error: upgradeError.message }), {
      headers: {'Content-Type': 'application/json'},
      status: 500,
    });
  }

  userBooster.level += 1;
  return new Response(
    JSON.stringify(
      convertToBoosterWithContext({
        ...userBooster.booster,
        user_booster: [userBooster],
      }),
    ),
    {
      headers: {'Content-Type': 'application/json'},
    },
  );
};
