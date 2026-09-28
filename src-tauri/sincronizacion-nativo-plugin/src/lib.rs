use tauri::{plugin::{Builder, TauriPlugin}, Manager, Runtime};

#[cfg(mobile)]
mod mobile {
    use tauri::{plugin::{PluginApi, PluginHandle}, AppHandle, Runtime};

    pub fn init<R: Runtime>(
        app: &AppHandle<R>,
        api: PluginApi<R, ()>,
    ) -> tauri::Result<SincronizacionNativo<R>> {
        let handle = api.register_android_plugin(
            "com.rassembly.app",
            "PluginSincronizacionNativo",
        )?;
        Ok(SincronizacionNativo(handle))
    }

    pub struct SincronizacionNativo<R: Runtime>(pub PluginHandle<R>);
}

#[cfg(desktop)]
mod desktop {
    use tauri::{plugin::PluginApi, AppHandle, Runtime};

    pub fn init<R: Runtime>(
        _app: &AppHandle<R>,
        _api: PluginApi<R, ()>,
    ) -> tauri::Result<()> {
        Ok(())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("sincronizacion-nativo")
        .setup(|app, api| {
            #[cfg(mobile)]
            {
                app.manage(mobile::init(app, api)?);
            }
            #[cfg(desktop)]
            {
                app.manage(desktop::init(app, api)?);
            }
            Ok(())
        })
        .build()
}
