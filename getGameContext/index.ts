import { createClient } from "https://esm.sh/@shaple/shaple@0.2.2";
import {convertToGameContext} from '../_dto/game.ts';
import {
  calculateEnergyLimit,
  calculateRestoredEnergy,
} from '../_rules/rule.ts';

/**
 * Get user's game profile. If profile is not found, create a new one.
 * @param req
 */

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
    data: {user},
  } = await client.auth.getUser(jwt);

  if (!user) {
    console.error('User not found in getGameContext');
    return new Response('Invalid auth user', {
      headers: {'Content-Type': 'application/json'},
      status: 401,
    });
  }

  // get or create game profile
  const {data: gameProfile, error} = await client
    .schema('clicker')
    .from('game_profile')
    .upsert(
      {
        owner: user.id,
      },
      {
        onConflict: 'owner',
      },
    )
    .single()
    .select(
      `*, user_booster (*, booster (*)), user_daily_booster (*, daily_booster (*))`,
    );

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({error: error.message}), {
      headers: {'Content-Type': 'application/json'},
      status: 500,
    });
  }

  const userBoosters = gameProfile.user_booster ?? ([] as any[]);
  const userDailyBoosters = gameProfile.user_daily_booster ?? ([] as any[]);

  // renew energy if needed
  const energyLimitBooster = userBoosters.find(
    (item: any) => item.booster.type === 'ENERGY_LIMIT',
  );
  const maxEnergyLimit = calculateEnergyLimit(energyLimitBooster?.level ?? 0);
  if (gameProfile.energy_balance < maxEnergyLimit) {
    const now = Date.now();
    const restoredEnergy = calculateRestoredEnergy(
      new Date(gameProfile.last_energy_updated_at).getTime(),
      now,
    );
    const newEnergyBalance = Math.min(
      gameProfile.energy_balance + restoredEnergy,
      maxEnergyLimit,
    );

    const {error} = await client
      .schema('clicker')
      .from('game_profile')
      .update({
        energy_balance: newEnergyBalance,
        last_energy_updated_at: new Date(now),
      })
      .eq('id', gameProfile.id);

    if (error) {
      console.error(error);
      return new Response(JSON.stringify({error: error.message}), {
        headers: {'Content-Type': 'application/json'},
        status: 500,
      });
    }

    gameProfile.energy_balance = newEnergyBalance;
  }

  return new Response(
    JSON.stringify(
      convertToGameContext(gameProfile, userBoosters, userDailyBoosters),
    ),
    {
      headers: {'Content-Type': 'application/json'},
      status: 200,
    },
  );
};
