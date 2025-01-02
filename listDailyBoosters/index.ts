import { createClient } from 'jsr:@supabase/supabase-js@2';
import { convertToDailyBoosterWithContext } from '../_dto/booster.ts';

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

  const { data: gameProfile, getGameProfileError } = await client
    .schema('clicker')
    .from('game_profile')
    .select()
    .eq('owner', user.id)
    .single();

  if (getGameProfileError) {
    console.error(getGameProfileError);
    return new Response(
      JSON.stringify({ error: getGameProfileError.message }),
      {
        headers: {'Content-Type': 'application/json'},
        status: 500,
      },
    );
  }

  const { data: boosters, error } = await client
    .schema('clicker')
    .from('daily_booster')
    .select(`*, user_daily_booster (*)`)
    .eq('user_daily_booster.game_profile_id', gameProfile.id);

  if (error) {
    console.error(error);
    return new Response('Failed to get boosters', {
      headers: {'Content-Type': 'application/json'},
      status: 500,
    });
  }

  return new Response(
    JSON.stringify(
      boosters.map((booster: any) => convertToDailyBoosterWithContext(booster)),
    ),
    {
      headers: {'Content-Type': 'application/json'},
    },
  );
};
