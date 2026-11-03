from index import spotifyapi

o = spotifyapi(generatelisten=False)
damn = o.spotigetitem("0UdD4Z9SPsC89OWKqMPCld", "playlist")["items"]
darija_art = {
    "2g8Pu5gVtDpkYGsP3RLepJ": "Draganov",
    "06zZhrjGip0peNfom4XCYI": "Najm",
    "4BFLElxtBEdsdwGA1kHTsx": "ElGrandeToto",
    "1akll7SRGZblDrbCF5eqYW": "Moro",
    "5Do9u0GoN4gFn6Nk8NGDhh": "Stormy",
    "34VsGNAA5FLYSXT9U1OXD7": "Drvco",
    "2ORmu3PJ825VSiXknGy6Ma": "Mirv48",
    "0RM7X5kb4RzuDItJhqy3A1": "777YM",
    "3TrVF9qBaVVsKYfiE7QlEU": "Clayforeal",
    "22XDOoz1O9YU6Ekq5FEcK1": "Shaw",
}
to_add = []
darija_uris = set()
for item in damn:
    darija = o.spoticollect(item)
    darija_uris.add(darija["uri"])

liking = o.spotilike()
for item in liking:
    like_track = o.spoticollect(item)
    if like_track["uri"] in darija_uris:
        continue
    for art in like_track["artists"]:
        if art["id"] in darija_art:
            darija_uris.add(like_track["uri"])
            to_add.append(like_track["uri"])
            break

o.add_songs(to_add, "0UdD4Z9SPsC89OWKqMPCld")
