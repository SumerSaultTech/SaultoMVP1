{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.nodePackages.npm
    pkgs.postgresql
    pkgs.python311
    pkgs.python311Packages.pip
  ];
}