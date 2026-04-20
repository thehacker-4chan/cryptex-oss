begin;
select plan(20);

-- Create two fixture users via Supabase test helpers
select tests.create_supabase_user('alice@example.com', 'Alice');
select tests.create_supabase_user('bob@example.com', 'Bob');

-- Alice seeds one row in every synced table so Bob has targets to probe
select tests.authenticate_as('alice@example.com');
insert into chats(id, owner_id, title, model_qualified_id)
  values ('chat-a', auth.uid(), 'Alice chat', 'openrouter:auto');
insert into messages(id, owner_id, chat_id, role, content)
  values ('msg-a', auth.uid(), 'chat-a', 'user', 'hello');
insert into attachments(id, owner_id, message_id, kind, name, mime, size, storage_path)
  values ('att-a', auth.uid(), 'msg-a', 'text', 'a.txt', 'text/plain', 3, auth.uid()::text || '/a.txt');
insert into attack_chain_runs(id, owner_id, chat_id, input, layers, layer_params, execute_enabled, results)
  values ('run-a', auth.uid(), 'chat-a', 'x', '{base64}', '{}'::jsonb, false, '[]'::jsonb);
insert into custom_presets(id, owner_id, name, layers, layer_params)
  values ('preset-a', auth.uid(), 'Alice preset', '{base64}', '{}'::jsonb);
insert into byok_keys(owner_id, provider_id, ciphertext, iv, salt)
  values (auth.uid(), 'openrouter', '\x00'::bytea, '\x00'::bytea, '\x00'::bytea);

-- Alice uploads a storage object under her own prefix (using modern owner_id uuid column)
insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('attachments', auth.uid()::text || '/alice.txt', auth.uid(), '{}'::jsonb);

select tests.authenticate_as('bob@example.com');

-- 5 read-isolation asserts: Bob cannot see any of Alice's rows
select is( (select count(*) from chats where id = 'chat-a')::int, 0, 'Bob cannot select Alice chat' );
select is( (select count(*) from messages where id = 'msg-a')::int, 0, 'Bob cannot select Alice message' );
select is( (select count(*) from attachments where id = 'att-a')::int, 0, 'Bob cannot select Alice attachment' );
select is( (select count(*) from attack_chain_runs where id = 'run-a')::int, 0, 'Bob cannot select Alice attack_chain_run' );
select is( (select count(*) from byok_keys)::int, 0, 'Bob cannot select Alice byok_keys' );

-- 6 INSERT-spoof throw asserts: Bob cannot insert a row claiming Alice as owner
select throws_ok(
  $$ insert into chats(id, owner_id, title, model_qualified_id)
       values ('chat-b-spoof', (select id from auth.users where email = 'alice@example.com'), 'spoof', 'x') $$,
  '42501',
  'new row violates row-level security policy for table "chats"',
  'Bob cannot spoof owner_id on chats insert'
);
select throws_ok(
  $$ insert into messages(id, owner_id, chat_id, role, content)
       values ('msg-b-spoof', (select id from auth.users where email = 'alice@example.com'), 'chat-a', 'user', 'spoof') $$,
  '42501',
  null,
  'Bob cannot spoof owner_id on messages insert'
);
select throws_ok(
  $$ insert into attachments(id, owner_id, message_id, kind, name, mime, size, storage_path)
       values ('att-b-spoof', (select id from auth.users where email = 'alice@example.com'), 'msg-a', 'text', 'x', 'text/plain', 1, 'x') $$,
  '42501',
  null,
  'Bob cannot spoof owner_id on attachments insert'
);
select throws_ok(
  $$ insert into attack_chain_runs(id, owner_id, chat_id, input, layers, layer_params, execute_enabled, results)
       values ('run-b-spoof', (select id from auth.users where email = 'alice@example.com'), 'chat-a', 'x', '{base64}', '{}'::jsonb, false, '[]'::jsonb) $$,
  '42501',
  null,
  'Bob cannot spoof owner_id on attack_chain_runs insert'
);
select throws_ok(
  $$ insert into custom_presets(id, owner_id, name, layers, layer_params)
       values ('preset-b-spoof', (select id from auth.users where email = 'alice@example.com'), 'spoof', '{base64}', '{}'::jsonb) $$,
  '42501',
  null,
  'Bob cannot spoof owner_id on custom_presets insert'
);
select throws_ok(
  $$ insert into byok_keys(owner_id, provider_id, ciphertext, iv, salt)
       values ((select id from auth.users where email = 'alice@example.com'), 'openrouter', '\x00'::bytea, '\x00'::bytea, '\x00'::bytea) $$,
  '42501',
  null,
  'Bob cannot spoof owner_id on byok_keys insert'
);

-- 2 update/delete blocked asserts
select is( (with u as (update chats set title = 'hijack' where id = 'chat-a' returning 1) select count(*) from u)::int, 0, 'Bob update on Alice chat affects 0 rows' );
select is( (with d as (delete from chats where id = 'chat-a' returning 1) select count(*) from d)::int, 0, 'Bob delete on Alice chat affects 0 rows' );

-- 3 Storage asserts
-- Bob cannot read Alice's storage objects
select is(
  (select count(*) from storage.objects
     where bucket_id = 'attachments'
       and name like (select id::text from auth.users where email = 'alice@example.com') || '/%')::int,
  0,
  'Bob cannot read Alice storage objects'
);
-- Bob cannot write into Alice's storage prefix
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
       values ('attachments',
               (select id::text from auth.users where email = 'alice@example.com') || '/bob-spoof.txt',
               auth.uid(),
               '{}'::jsonb) $$,
  '42501',
  null,
  'Bob cannot write into Alice storage prefix'
);
-- Bob can upload to his own prefix
insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('attachments', auth.uid()::text || '/bob.txt', auth.uid(), '{}'::jsonb);
select is(
  (select count(*) from storage.objects
     where bucket_id = 'attachments' and name = auth.uid()::text || '/bob.txt')::int,
  1,
  'Bob can upload to his own storage prefix'
);

-- 2 reserve asserts (profile + Alice own-insert works)
select tests.authenticate_as('alice@example.com');
select is( (select plan from profiles where id = auth.uid()), 'free', 'Alice has free plan by default (profile trigger fired)' );
insert into chats(id, owner_id, title, model_qualified_id)
  values ('chat-a2', auth.uid(), 'Alice chat 2', 'openrouter:auto');
select is( (select count(*) from chats where id = 'chat-a2')::int, 1, 'Alice can insert her own chat' );

-- Alice can read her own storage object (positive control for owner-prefix SELECT policy)
select is(
  (select count(*) from storage.objects
     where bucket_id = 'attachments' and name = auth.uid()::text || '/alice.txt')::int,
  1,
  'Alice can read her own storage object'
);

-- Bob can write + read his own chat row (positive control for chats RLS)
select tests.authenticate_as('bob@example.com');
insert into chats(id, owner_id, title, model_qualified_id)
  values ('chat-b', auth.uid(), 'Bob chat', 'openrouter:auto');
select is( (select count(*) from chats where id = 'chat-b')::int, 1, 'Bob can select his own chat' );

select * from finish();
rollback;
