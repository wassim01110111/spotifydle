#!/home/wassim/myenv/bin/python
try:
    from datetime import datetime
    from random import shuffle

    from index import spotifyapi
    from indextools import ms_to_hms

    o = spotifyapi(no_thread=False)
    o2 = spotifyapi(no_thread=True, account="zorhooah", user_other_listen=o)
    blacklist2 = o.spotifuck(playsource=o.listenlistid, genre="playlist", filter=True)
    accounts = [
        (o, "282761ae1ce7c84e", "default"),
        (o2, "3601f77fdbdf4787", "zorhooah"),
    ]
    names = []
    uris = []
    blacklist = ["montreal", "canadian", "québéc", "québéc"]
    time_deleted = 0
    for account, folder_id, account_name in accounts:
        print(f"checking {account_name}'s account")
        recommended_section = account.browsesection("0JQ5DAzrKrXkGbsWrJvdV8")
        playlists = account.spotifolder(folder_id)
        # playlists += o.spotiradio()

        for section in recommended_section["items"]:
            top_tracks = account.spotiartist(section["artists"][0]["id"])["top_tracks"]
            for track in top_tracks:
                uri, inf = account.spoticollect(
                    track_dico=track,
                    filter=True,
                    requirePlayable=True,
                    art=None,
                    moreinfo=True,
                )
                if uri:
                    time_deleted += inf["duration"]
                    uris.append(uri)
        for playsource in playlists:
            skip = False
            try:
                name = playsource["name"].lower()
                if any(bl in name for bl in blacklist):
                    print(f"{name} ---- Blacklist detected, not adding\n")
                    skip = True
                if not skip:
                    urisS, moreinfo = account.spotifuck(
                        playsource=playsource["id"],
                        genre="playlist",
                        filter=True,
                        art=None,
                        blacklist=False,
                        moreinfo=True,
                        requirePlayable=True,
                    )
                    time_deleted += sum(
                        track["duration"] for track in moreinfo["track_info"]
                    )
                    uris += urisS
                    if len(urisS):
                        names.append(name)
                        print(f"Found {len(urisS)} new tracks in {name}")
            except Exception as e:
                print(f"An error occured with {playsource}:\n{e}")
    if uris:
        shuffle(uris)
        o.add_songs(
            uris,
            playreceiving=o.listenlistid,
            descr=f"Added {len(uris)} songs ({ms_to_hms(time_deleted)}) as of {datetime.now()}. From {', '.join(names) if names else 'spotifuck'}.",
        )
    else:
        if blacklist2:
            o.dump_json()
        print("No new tracks")
except Exception as e:
    import traceback

    from gmail import mail

    m = mail()
    m.sendmail(f"{__file__} error {datetime.now()}", f"{traceback.format_exc()}\n\n{e}")
