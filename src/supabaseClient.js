import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://zazgmlbdkvyleqfpdyzb.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphemdtbGJka3Z5bGVxZnBkeXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1OTExNTgsImV4cCI6MjA3MjE2NzE1OH0.DBuwhHst30-GjwPNo99u-fzqdYRU6rLvHJCkejB3kfk'
);