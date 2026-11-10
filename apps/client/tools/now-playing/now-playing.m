// Now Playing bridge: loaded into /usr/bin/perl (which macOS lets read MediaRemote), prints one JSON
// line per change and runs commands read from stdin: toggle, play, pause, next, previous.
#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#include <dlfcn.h>

typedef void (*GetInfo)(dispatch_queue_t, void (^)(NSDictionary *));
typedef void (*GetPid)(dispatch_queue_t, void (^)(int));
typedef void (*GetPlaying)(dispatch_queue_t, void (^)(BOOL));
typedef BOOL (*SendCommand)(int, NSDictionary *);

static NSString *esc(id v) {
	if (![v isKindOfClass:[NSString class]]) return @"";
	NSData *d = [NSJSONSerialization dataWithJSONObject:@[v] options:0 error:nil];
	NSString *s = [[NSString alloc] initWithData:d encoding:NSUTF8StringEncoding];
	return [s substringWithRange:NSMakeRange(2, s.length - 4)];
}

__attribute__((constructor)) static void novex_now_playing(void) {
	if (!getenv("NOVEX_NOW_PLAYING")) return;
	void *mr = dlopen("/System/Library/PrivateFrameworks/MediaRemote.framework/MediaRemote", RTLD_LAZY);
	GetInfo info = (GetInfo) dlsym(mr, "MRMediaRemoteGetNowPlayingInfo");
	GetPid pid = (GetPid) dlsym(mr, "MRMediaRemoteGetNowPlayingApplicationPID");
	GetPlaying playing = (GetPlaying) dlsym(mr, "MRMediaRemoteGetNowPlayingApplicationIsPlaying");
	SendCommand send = (SendCommand) dlsym(mr, "MRMediaRemoteSendCommand");
	if (!info || !send) { printf("{\"error\":\"no MediaRemote\"}\n"); fflush(stdout); exit(1); }
	dispatch_queue_t q = dispatch_queue_create("novex.np", 0);
	// Commands from stdin; the bridge ends when the game closes the pipe.
	[NSThread detachNewThreadWithBlock:^{
		char line[64];
		while (fgets(line, sizeof line, stdin)) {
			int c = -1;
			if (!strncmp(line, "toggle", 6)) c = 2;
			else if (!strncmp(line, "play", 4)) c = 0;
			else if (!strncmp(line, "pause", 5)) c = 1;
			else if (!strncmp(line, "next", 4)) c = 4;
			else if (!strncmp(line, "previous", 8)) c = 5;
			if (c >= 0) send(c, nil);
		}
		exit(0);
	}];
	NSString *last = nil;
	for (;;) {
		@autoreleasepool {
			dispatch_semaphore_t done = dispatch_semaphore_create(0);
			__block NSDictionary *d = nil;
			__block int p = 0;
			__block BOOL on = NO;
			info(q, ^(NSDictionary *x) { d = x; dispatch_semaphore_signal(done); });
			dispatch_semaphore_wait(done, dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC));
			if (pid) { pid(q, ^(int x) { p = x; dispatch_semaphore_signal(done); }); dispatch_semaphore_wait(done, dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC)); }
			if (playing) { playing(q, ^(BOOL x) { on = x; dispatch_semaphore_signal(done); }); dispatch_semaphore_wait(done, dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC)); }
			NSString *app = p ? [NSRunningApplication runningApplicationWithProcessIdentifier:p].localizedName : nil;
			double duration = [d[@"kMRMediaRemoteNowPlayingInfoDuration"] doubleValue];
			double elapsed = [d[@"kMRMediaRemoteNowPlayingInfoElapsedTime"] doubleValue];
			NSDate *at = d[@"kMRMediaRemoteNowPlayingInfoTimestamp"];
			double rate = [d[@"kMRMediaRemoteNowPlayingInfoPlaybackRate"] doubleValue];
			if (at && on) elapsed += -[at timeIntervalSinceNow] * (rate > 0 ? rate : 1);
			NSString *out = [NSString stringWithFormat:@"{\"title\":\"%@\",\"artist\":\"%@\",\"album\":\"%@\",\"app\":\"%@\",\"playing\":%s,\"elapsed\":%.1f,\"duration\":%.1f}",
				esc(d[@"kMRMediaRemoteNowPlayingInfoTitle"]), esc(d[@"kMRMediaRemoteNowPlayingInfoArtist"]),
				esc(d[@"kMRMediaRemoteNowPlayingInfoAlbum"]), esc(app), on ? "true" : "false", elapsed, duration];
			if (![out isEqualToString:last]) { printf("%s\n", out.UTF8String); fflush(stdout); last = out; }
		}
		usleep(500000);
	}
}
