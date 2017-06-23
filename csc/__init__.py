from pyramid.authentication import AuthTktAuthenticationPolicy
from pyramid.authorization import ACLAuthorizationPolicy
from pyramid.config import Configurator

from .security import groupfinder

def main(global_config, **settings):
    """ This function returns a Pyramid WSGI application.
    """
    config = Configurator(settings=settings)
    config.include('pyramid_jinja2')

    # Security policies
    authn_policy = AuthTktAuthenticationPolicy(
        settings['csc.secret'], callback=groupfinder,
        hashalg='sha512')
    authz_policy = ACLAuthorizationPolicy()

    config.set_authentication_policy(authn_policy)
    config.set_authorization_policy(authz_policy)

    config.add_static_view('static', 'static', cache_max_age=3600)

    config.add_route('home', '/')
    config.add_route('login', '/login')
    config.add_route('logout', '/logout')

    config.add_route('club', '/club/{id}')  # this is used everywhere but...
    config.add_route('Club', '/club/{id}')  # ... but in the views where the route is found using the name of the class
    config.add_route('company', '/company/{id}')
    config.add_route('Company', '/company/{id}')
    config.add_route('competition', '/competition/{id}')
    config.add_route('Competition', '/competition/{id}')
    config.add_route('competition_host', '/competition_host/{id}')
    config.add_route('CompetitionHost', '/competition_host/{id}')
    config.add_route('school', '/school/{id}')
    config.add_route('School', '/school/{id}')
    config.add_route('test', '/test')
    config.add_route('user', '/user/{id}')
    config.add_route('User', '/user/{id}')

    config.add_route('create_user', '/create_user')
    config.add_route('search', '/search/{txt}')

    config.scan('.views')

    return config.make_wsgi_app()