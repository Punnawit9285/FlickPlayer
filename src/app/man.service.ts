import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders, HttpParams} from '@angular/common/http';
import {combineLatestWith, Observable, of, startWith, takeUntil, throwError, timer} from 'rxjs';
import {catchError, map, shareReplay, switchMap, timeout} from 'rxjs/operators';
import {PlayHistory, PlayHistoryValue, PlayTrackerService} from './play-tracker.service';
import {AuthService} from './auth.service';


@Injectable({
    providedIn: 'root'
})
export class ManService {
    private http = inject(HttpClient);
    private playTracker = inject(PlayTrackerService);
    private authService = inject(AuthService);

    private videoList: Observable<CourseListResponse>;
    private endpoint = ['https://flick-man-app.docchula.com/', 'https://flick-man-cdn.docchula.com/'];
    private originalEndpoint = ['https://flick-man-cdn.docchula.com/'];

    constructor() {
        // remoteConfig: RemoteConfig
        /* if (environment.production) {
            // Get endpoint config
            getStringChanges(remoteConfig, 'manEndpoint').pipe(filter(v => !!v)).subscribe(v => {
                const w = v.split(',');
                this.endpoint = w;
                this.originalEndpoint = w;
            });
        } */
    }

    getVideoList(): Observable<CourseListResponse> {
        if (!this.videoList) {
            this.videoList = this.get<JSend<CourseListResponse>>('v1/video').pipe(
                map(response => response?.data),
                shareReplay(1),
            );
        }
        return this.videoList;
    }

    getVideosInCourse(year: string | null, course: string | null, courseId: string | null) {
        return this.get<JSend<{
            lectures: CourseMembers,
            key: string,
            server?: string,
            category: string,
            name: string,
        }>>('v1/video/' + (courseId ?? (year + '/' + course)))
            .pipe(map(response => {
                if (!response || !response.data) {
                    return null;
                }
                const data = response.data;
                let server = data.server ?? (this.getEndpointLocation() + 'stream');
                if (!server.endsWith('/')) {
                    server += '/';
                }
                for (const courseKey of Object.keys(data.lectures)) {
                    let thisLecture = data.lectures[courseKey];
                    thisLecture = {
                        ...thisLecture,
                        sources: thisLecture.sources ? thisLecture.sources.map(source => {
                            source.src = source.src
                                ?? ((source.server ?? server) + source.path);
                            if (source.src.includes('docchula.com')) {
                                source.src += (source.src.includes('?') ? '&key=' : '?key=') + encodeURIComponent(data.key);
                            }
                            return source;
                        }) : [],
                        attachments: thisLecture.attachments ? thisLecture.attachments.map(source => {
                            source.src = source.src
                                ?? ((source.server ?? server) + source.path);
                            source.src += (source.src.includes('?') ? '&key=' : '?key=') + encodeURIComponent(data.key);
                            source.name = source.name ?? (source.path.startsWith('DL ') ? source.path.substring(3) : source.path);
                            return source;
                        }) : [],
                        identifier: thisLecture.identifier ?? String(thisLecture.id),
                        durationInMin: thisLecture.duration ? Math.round(thisLecture.duration / 60) : 0,
                    };
                    for (const source of thisLecture.sources) {
                        if (!source.type.startsWith('application/dash+xml')) {
                            thisLecture.sourceExternal = source.src;
                            break;
                        }
                    }
                    data.lectures[courseKey] = thisLecture;
                }
                return data;
            }));
    }

    getVideo(videoId: string): Observable<LectureDocInfo | null> {
        const body = {
            query: `query GetVideo($id: ID!) {
                video(id: $id) {
                    id
                    document
                }
            }`,
            variables: {id: videoId},
        };
        return this.post<{ data: { video: LectureDocInfo | null } }>('graphql', body)
            .pipe(map(response => response?.data?.video ?? null));
    }

    getPlayRecord(year: string, course: string, courseId: string | null, stopPolling: Observable<boolean>): Observable<{
        records: PlayHistory,
        evaluations: { [key: number]: EvaluationRecord },
    }> {
        const params = courseId ? new HttpParams().set("course_id", courseId ?? '') : new HttpParams().set("year", year).set("course", course);
        return timer(1, 60000).pipe(
            switchMap(() => this.get<JSend<{
                records: PlayHistory,
                evaluations: { [key: number]: EvaluationRecord },
            }>>('v1/play_records', {params}).pipe(map(response => response?.data))),
            // Replace value with update from play tracker if available
            combineLatestWith(this.playTracker.retrieve().pipe(startWith(null))),
            map(([data, update]) => {
                const records = data?.records ?? {};
                if (update) {
                    if (!records[update.video_id] ||
                        (records[update.video_id].played_at < update.played_at)) {
                        records[update.video_id] = update;
                    }
                }
                return {
                    records,
                    evaluations: data?.evaluations ?? {},
                };
            }),
            takeUntil(stopPolling),
        );
    }

    updatePlayRecord(uid: string, video_id: string | number, progress: number, speed: number, log: object[]) {
        return this.post<JSend<null>>('v1/play_records', {
            uid,
            video_id,
            progress,
            speed,
            log,
        });
    }

    sendEvaluation(type: string, video: string | number, result: { delivery: number | null, material: number | null, video: number | null }) {
        return this.post<JSend<null>>('v1/evaluations', {type, video, result});
    }

    checkAuthorization(): Observable<boolean> {
        return this.get<object>('v1/auth_check').pipe(timeout(8000), map(a => a.hasOwnProperty('success')));
    }

    changeEndpoint() {
        this.endpoint.push(this.endpoint.shift());
    }

    get<T>(path: string, options?: object): Observable<T> {
        return this.withIdToken(headers => this.http.get<T>(this.getEndpointLocation() + path, {headers, ...options}));
    }

    post<T>(path: string, body: object): Observable<T> {
        return this.withIdToken(headers => this.http.post<T>(this.getEndpointLocation() + path, body, {headers}));
    }

    searchVideos(query: string): Observable<SearchVideoResult[]> {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            return of([]);
        }
        const keyword = '%' + trimmed + '%';
        const or: { column: string, operator: string, value: string }[] = [
            {column: 'TITLE', operator: 'LIKE', value: keyword},
            {column: 'LECTURER', operator: 'LIKE', value: keyword},
        ];
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            or.push({column: 'RECORD_DATE', operator: 'EQ', value: trimmed});
        }
        const body = {
            query: `query SearchVideos($where: QueryVideosWhereWhereConditions) {
                videos(where: $where, first: 100) {
                    data { id title lecturer duration course_id }
                }
            }`,
            variables: {where: {OR: or}},
        };
        return this.post<{ data: { videos: { data: SearchVideoResult[] } } }>('graphql', body)
            .pipe(map(response => response?.data?.videos?.data ?? []));
    }

    /**
     * Sends `request` with a freshly fetched ID token, or emits null without a request when signed out.
     * On a 401, refreshes the token and retries once, in case the server rejects a token that Firebase
     * still considers valid (e.g. after the device clock was corrected).
     */
    private withIdToken<T>(request: (headers: HttpHeaders) => Observable<T>): Observable<T> {
        const send = (forceRefresh: boolean) => this.authService.getIdToken(forceRefresh).pipe(
            switchMap(idToken => {
                if (!idToken) {
                    console.error('ManService ID token is not set.');
                } else if (!this.getEndpointLocation()) {
                    console.error('ManService endpoint is not set.');
                } else {
                    return request(new HttpHeaders({Authorization: 'Bearer ' + idToken}));
                }
                return of(null);
            }),
        );
        return send(false).pipe(
            catchError(error => error instanceof HttpErrorResponse && error.status === 401
                ? send(true)
                : throwError(() => error)),
        );
    }

    /*updateCurrentStudent(requestBody) {
        if (!this.email) {
            console.error('ManService user email is not set.');
        }
        return this.patch('students/' + this.email, requestBody);
    }*/

    private getEndpointLocation(): string {
        if (this.endpoint.length > 0) {
            return this.endpoint[0];
        } else {
            return this.originalEndpoint[0];
        }
    }

    /*patch(path: string, body): Observable<Object> {
        if (this.httpOptions.headers.get('Authorization').length < 5) {
            console.error('ManService ID token is not set.');
        }
        return this.http.patch(ManEndpoint + path, body, this.httpOptions);
    }*/
}

export const ManServiceStub: Partial<ManService> = {
    getVideosInCourse: () => of({lectures: {}, key: '', category: '', name: ''}),
    getVideoList: () => of({years: {}, last_fetched_at: '', last_played: null}),
};

export interface CourseMembers {
    [key: string]: Lecture;
}

export interface CourseListResponse {
    years: {
        [key: string]: {
            id: number;
            name: string;
            is_remote: boolean;
        }[];
    };
    last_fetched_at: string;
    last_played: { video: Lecture, played_at: string, end_time: number } | null;
}

export interface EvaluationRecord {
    id: number;
    type: string;
    video_id: number;
}

export interface Lecture {
    title: string;
    lecturer: string;
    date: string | null;
    id?: number; // Server-side ID
    identifier?: string; // Client-side ID, deprecated
    sources: {
        path?: string,
        type: string,
        server: string | null,
        src: string
    }[];
    attachments: {
        server: string | null,
        path: string,
        src?: string,
        name?: string
    }[];
    sourceExternal?: string;
    duration?: number;
    durationInMin?: number;
    history?: PlayHistoryValue;
    is_evaluated?: boolean;
    has_document?: boolean;
    course?: {
        id: number;
        name: string;
        category: string;
    };
}

export interface LectureDocInfo {
    id: number; // Server-side ID
    document: string | null;
}

export interface JSend<A> {
    status: string;
    message?: string;
    data?: A;
}

export interface SearchVideoResult {
    id: string;
    title: string;
    lecturer: string;
    duration: number;
    course_id: string;
}
