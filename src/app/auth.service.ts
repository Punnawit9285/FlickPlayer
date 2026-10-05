import {inject, Injectable} from '@angular/core';
import {Auth, getRedirectResult, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, user, User} from '@angular/fire/auth';
import {BehaviorSubject, defer, Observable, Subscription} from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private auth: Auth = inject(Auth);
    user$ = user(this.auth);
    userSubscription: Subscription;

    private readonly userSubject = new BehaviorSubject<User|null>(null);
    public readonly user = this.userSubject.asObservable();

    constructor() {
        this.userSubscription = this.user$.subscribe((aUser: User | null) => {
            this.userSubject.next(aUser);
        });
        getRedirectResult(this.auth).catch((error) => console.error('getRedirectResult failed', error));
    }

    /**
     * Emits the signed-in user's ID token, or null when signed out. Firebase returns the cached token,
     * refreshing it first if it is about to expire. Call this for every request instead of keeping the
     * token: nothing in this app makes Firebase refresh it in the background, so a kept token expires
     * within an hour.
     */
    getIdToken(forceRefresh = false): Observable<string | null> {
        return defer(async () => {
            await this.auth.authStateReady();
            return this.auth.currentUser ? this.auth.currentUser.getIdToken(forceRefresh) : null;
        });
    }

    signIn() {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({hd: 'docchula.com'});
        // Redirect relies on the Firebase Hosting reserved /__/auth/** paths on
        // the authDomain, which localhost dev servers don't serve. Popup works
        // there since it doesn't need those paths, so use it only for localhost.
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            return signInWithPopup(this.auth, provider);
        }
        return signInWithRedirect(this.auth, provider);
    }

    signOut() {
        return signOut(this.auth);
    }

}
