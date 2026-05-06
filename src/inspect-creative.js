import { meta } from './client.js';

let adId = process.argv[2];
if (!adId) {
  const ads = await meta.getAll('/act_930175825635997/ads', {
    fields: 'id,name',
    effective_status: JSON.stringify(['ACTIVE']),
    limit: 5,
  });
  if (!ads.length) { console.log('no active ads found'); process.exit(1); }
  adId = ads[0].id;
  console.log(`(no ad_id given — picked first active: ${adId} "${ads[0].name}")\n`);
}

const ad = await meta.get(`/${adId}`, {
  fields: 'name,creative{id,name,body,title,call_to_action_type,asset_feed_spec,object_story_spec,object_story_id,effective_object_story_id,object_type,video_id,image_url,image_hash,thumbnail_url,instagram_permalink_url,url_tags}',
});
console.log('AD:', JSON.stringify(ad, null, 2));

const story = ad.creative?.object_story_id || ad.creative?.effective_object_story_id;
if (story) {
  console.log(`\n--- fetching underlying post /${story} ---\n`);
  try {
    const post = await meta.get(`/${story}`, {
      fields: 'id,message,story,full_picture,attachments{type,title,description,media_type,url,subattachments,target,media}',
    });
    console.log(JSON.stringify(post, null, 2));
  } catch (e) {
    console.log('ERROR fetching post:', e.message);
  }
}
