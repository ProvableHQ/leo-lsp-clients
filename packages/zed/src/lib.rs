use std::path::Path;

use zed_extension_api::{
    self as zed, Command, LanguageServerId, Result, Worktree, settings::LspSettings,
};

const SERVER_BINARY_NAME: &str = "leo-lsp";

struct LeoExtension;

impl zed::Extension for LeoExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<Command> {
        let settings =
            LspSettings::for_worktree(language_server_id.as_ref(), worktree).unwrap_or_default();
        let configured_binary = settings.binary.as_ref();

        let configured_path = configured_binary
            .and_then(|b| b.path.as_ref())
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty());

        let configured_args: Vec<String> = configured_binary
            .and_then(|b| b.arguments.clone())
            .unwrap_or_default();

        let configured_env: Vec<(String, String)> = configured_binary
            .and_then(|b| b.env.clone())
            .map(|m| m.into_iter().collect())
            .unwrap_or_default();

        let shell_env: Vec<(String, String)> = worktree.shell_env().into_iter().collect();
        let mut env = shell_env;
        env.extend(configured_env);

        // Tier 1: configured path.
        if let Some(path) = configured_path {
            let resolved = if Path::new(&path).is_absolute() {
                path.clone()
            } else {
                let root = worktree.root_path();
                format!("{root}/{path}")
            };
            if std::fs::metadata(&resolved)
                .map(|m| m.is_file())
                .unwrap_or(false)
            {
                return Ok(Command {
                    command: resolved,
                    args: configured_args,
                    env,
                });
            }
            return Err(format!(
                "Configured lsp.leo-lsp.binary.path did not resolve to an executable: {path}"
            ));
        }

        // Tier 4 (only): leo-lsp on $PATH via Worktree::which. Sway's pattern.
        if let Some(found) = worktree.which(SERVER_BINARY_NAME) {
            return Ok(Command {
                command: found,
                args: configured_args,
                env,
            });
        }

        Err(format!(
            "{SERVER_BINARY_NAME} not found on PATH. \
             Install with `cargo install --git https://github.com/ProvableHQ/leo leo-lsp --locked`, \
             or set `lsp.leo-lsp.binary.path` in your Zed settings to an absolute path."
        ))
    }

    fn language_server_initialization_options(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        Ok(
            LspSettings::for_worktree(language_server_id.as_ref(), worktree)
                .ok()
                .and_then(|s| s.initialization_options),
        )
    }

    fn language_server_workspace_configuration(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        Ok(
            LspSettings::for_worktree(language_server_id.as_ref(), worktree)
                .ok()
                .and_then(|s| s.settings),
        )
    }
}

zed::register_extension!(LeoExtension);
